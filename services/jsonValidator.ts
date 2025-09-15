import type { ValidationResult, SchemaIssue, DetailedError, FixAttempt, FixOperation } from './jsonValidatorTypes';

/**
 * Validates a JSON string, attempts to fix errors, and optionally compares it against a schema.
 * @param {string} jsonString The raw JSON string to validate.
 * @param {string|null} templateString An optional JSON string representing a schema/template.
 * @returns {ValidationResult} A result object with validation status, errors, and fixes.
 */
export function validate(jsonString: string, templateString: string | null = null): ValidationResult {
  const result: ValidationResult = {
    isValid: false,
    parsed: null,
    errors: [],
    detailedErrors: [],
    suggestions: [],
    fixedJSON: null,
    schemaIssues: [],
  };

  if (!jsonString || typeof jsonString !== 'string' || jsonString.trim() === '') {
    result.errors.push('Input must be a non-empty string');
    return result;
  }

  let templateObject: any = null;
  if (templateString) {
    try {
      templateObject = JSON.parse(templateString);
    } catch (e) {
      result.schemaIssues.push({ type: 'error', path: 'Template', message: 'The provided Schema/Template JSON is itself invalid and cannot be used for comparison.' });
    }
  }

  let fixedString = jsonString;
  try {
    result.parsed = JSON.parse(fixedString);
    result.isValid = true;
    result.fixedJSON = JSON.stringify(result.parsed, null, 2);
  } catch (error) {
    const detailedError = parseJSONError(error as Error, fixedString);
    result.errors.push((error as Error).message);
    result.detailedErrors.push(detailedError);
    
    const fixAttempt = attemptAdvancedFix(fixedString);
    if (fixAttempt.success) {
      result.fixedJSON = fixAttempt.fixed;
      fixedString = fixAttempt.fixed as string;
      result.suggestions = fixAttempt.suggestions;
      try {
          result.parsed = JSON.parse(fixedString);
          result.isValid = true; // It's valid after fixing
      } catch {}
    } else {
      result.suggestions = fixAttempt.suggestions;
    }
  }
  
  if (templateObject && result.parsed) {
      result.schemaIssues.push(...compareWithTemplate(result.parsed, templateObject));
  }

  return result;
}

/**
 * Recursively compares an input object against a template object.
 */
export function compareWithTemplate(input: any, template: any, path = '$'): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  
  if (Array.isArray(template)) {
      if (!Array.isArray(input)) {
          issues.push({ type: 'error', path, message: `Type Mismatch: Expected an array but got ${typeof input}.` });
          return issues;
      }
      if (template.length > 0 && input.length > 0) {
          issues.push(...compareWithTemplate(input[0], template[0], `${path}[0]`));
      }
      return issues;
  }
  
  if (typeof template === 'object' && template !== null) {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
          issues.push({ type: 'error', path, message: `Type Mismatch: Expected an object but got ${Array.isArray(input) ? 'array' : typeof input}.`});
          return issues;
      }

      const templateKeys = Object.keys(template);
      const inputKeys = new Set(Object.keys(input));

      for (const key of templateKeys) {
          const newPath = `${path}.${key}`;
          if (!inputKeys.has(key)) {
              issues.push({ type: 'warning', path: newPath, message: `Missing Key: The key '${key}' is missing.` });
          } else {
              const templateValueType = Array.isArray(template[key]) ? 'array' : typeof template[key];
              const inputValueType = Array.isArray(input[key]) ? 'array' : typeof input[key];
              if (templateValueType !== inputValueType) {
                  issues.push({ type: 'error', path: newPath, message: `Type Mismatch: Expected type '${templateValueType}' but got '${inputValueType}'.` });
              } else if (typeof template[key] === 'object' && template[key] !== null) {
                  issues.push(...compareWithTemplate(input[key], template[key], newPath));
              }
          }
      }

      for (const key of Array.from(inputKeys)) {
          if (!templateKeys.includes(key)) {
              issues.push({ type: 'info', path: `${path}.${key}`, message: `Extra Key: The key '${key}' is present but not in the schema.` });
          }
      }
      return issues;
  }

  return issues;
}

/**
 * Parses a JSON.parse() error message to extract detailed information.
 */
export function parseJSONError(error: Error, jsonString: string): DetailedError {
  const errorMsg = error.message;
  const lines = jsonString.split('\n');
  let lineNumber: number | null = null, columnNumber: number | null = null, errorType = 'Syntax Error', context = '', expectedToken = '', actualToken = '', friendlyMessage: string | undefined = undefined;
  
  const posMatch = errorMsg.match(/at position (\d+)/); // V8/Chrome
  const firefoxMatch = errorMsg.match(/at line (\d+) column (\d+)/i); // Firefox

  if (posMatch) {
    const position = parseInt(posMatch[1], 10);
    const { line, column } = getLineColumnFromPosition(jsonString, position);
    lineNumber = line;
    columnNumber = column;
    context = getContextAroundLine(lines, lineNumber - 1, columnNumber - 1);
    const precedingText = jsonString.substring(0, position).trim();
    
    if (errorMsg.includes("Expected property name or '}'")) {
      errorType = 'Invalid Object Key or Trailing Comma';
      if (precedingText.endsWith(',')) {
         friendlyMessage = 'A trailing comma was found. JSON does not allow a comma after the last item in an object. For example, `{"key": "value",}` is invalid. Remove the comma.';
      } else {
         friendlyMessage = 'An object key might be missing or invalid. All keys in JSON must be strings enclosed in double quotes (e.g., `"key": "value"`). Check for unquoted keys or a missing comma.';
      }
    } else if (errorMsg.includes('Unexpected token')) {
      actualToken = errorMsg.match(/Unexpected token (.+?) in JSON/)?.[1] || '';
      errorType = 'Unexpected Token';
      
      if ((actualToken === '}' || actualToken === ']') && precedingText.endsWith(',')) {
          errorType = 'Trailing Comma';
          friendlyMessage = 'A trailing comma was found. JSON format does not allow a comma after the last item in an array or object. For example, `[1, 2,]` and `{"key":"value",}` are invalid. Remove the final comma.';
      } else if (actualToken === "'") {
          errorType = 'Invalid String Quote';
          friendlyMessage = "JSON strings must use double quotes (`\"`). Single quotes (`'`) are not permitted. For example, change `'value'` to `\"value\"`.";
      } else if (actualToken === '=') {
          errorType = 'Invalid Assignment';
          friendlyMessage = "JSON uses a colon (`:`) to separate keys from values, not an equals sign (`=`). This may be a typo (e.g., `:=` instead of just `:`) that needs to be corrected.";
      } else if (actualToken.toLowerCase() === 'u' && jsonString.substring(position).startsWith('undefined')) {
          errorType = 'Invalid Value';
          friendlyMessage = 'The value `undefined` is not valid in JSON. This is common when converting JavaScript objects. Use `null` instead or remove the key-value pair.';
      } else if (actualToken.match(/^[a-zA-Z]/)) {
          errorType = 'Unquoted String';
          friendlyMessage = `This looks like an unquoted string, key, or value. All strings and object keys in JSON must be enclosed in double quotes. For example, \`{ key: "value" }\` should be \`{ "key": "value" }\`.`;
      } else {
          friendlyMessage = `An unexpected character '${actualToken}' was found. This is often caused by a missing comma, a missing colon, or a typo. Please check the syntax around this character.`;
      }
    }
  } else if (firefoxMatch){
    lineNumber = parseInt(firefoxMatch[1], 10);
    columnNumber = parseInt(firefoxMatch[2], 10);
    context = getContextAroundLine(lines, lineNumber - 1, columnNumber - 1);

    if (errorMsg.includes('trailing comma')) {
        errorType = 'Trailing Comma';
        friendlyMessage = 'A trailing comma was found. JSON format does not allow a comma after the last item in an object or array. For example, `[1, 2,]` is invalid. Remove the final comma.';
    } else if (errorMsg.includes('expected property name')) {
        errorType = 'Invalid Object Key';
        friendlyMessage = 'An object key is expected here. All keys in JSON must be strings enclosed in double quotes (e.g., `"key": "value"`). Check for missing quotes or a missing comma before this line.';
    } else if (errorMsg.includes('expected a string')) {
        errorType = 'Invalid String';
        friendlyMessage = "This value was expected to be a string, but it isn't. Remember to wrap all strings in double quotes (`\"`). Single quotes are not allowed. For example, use `\"text\"` instead of `'text'` or `text`.";
    } else {
        errorType = 'Syntax Error';
        friendlyMessage = 'There is a syntax error at this location. Please check for issues like missing commas (,), colons (:), or mismatched brackets/braces ([]/{}).';
    }
  } else if (errorMsg.match(/Unterminated string|Unexpected end of JSON input/i)) {
    const unterminatedStringResult = findUnterminatedString(jsonString);
    if(unterminatedStringResult.line !== null && unterminatedStringResult.column !== null) {
        errorType = 'Unterminated String';
        lineNumber = unterminatedStringResult.line;
        columnNumber = unterminatedStringResult.column;
        context = getContextAroundLine(lines, lineNumber - 1, columnNumber - 1);
        friendlyMessage = "An unclosed string was detected. All strings in JSON must be enclosed in double quotes. Check for a missing closing quote (`\"`) on this line or a previous one.";
    } else {
        errorType = 'Unexpected End of Input';
        context = getContextAroundLine(lines, lines.length - 1);
        friendlyMessage = 'The JSON ends unexpectedly. This usually means you are missing a closing brace `}` for an object or a closing bracket `]` for an array.';
    }
  }
  
  if (!friendlyMessage) {
    friendlyMessage = 'The JSON structure is invalid. Please check for common syntax errors like missing commas, incorrect quotes, or mismatched brackets and braces.';
  }

  return { type: errorType, line: lineNumber, column: columnNumber, expected: expectedToken, actual: actualToken, context, message: errorMsg, friendlyMessage };
}

export function getLineColumnFromPosition(text: string, position: number): { line: number; column: number } {
  const lines = text.substring(0, position).split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export function getContextAroundLine(lines: string[], lineIndex: number, colIndex?: number, contextLines = 2): string {
  const start = Math.max(0, lineIndex - contextLines);
  const end = Math.min(lines.length, lineIndex + contextLines + 1);
  const contextSlice = lines.slice(start, end);

  if (colIndex !== undefined && colIndex >= 1 && lineIndex >= start && lineIndex < end) {
      const relativeLineIndex = lineIndex - start;
      const markerLine = ' '.repeat(colIndex - 1) + '^';
      // Insert marker line after the error line
      contextSlice.splice(relativeLineIndex + 1, 0, markerLine);
  }

  return contextSlice.join('\n');
}

export function findUnterminatedString(jsonString: string): { line: number | null; column: number | null; context: string } {
  const lines = jsonString.split('\n');
  let inString = false, stringChar = '', escaped = false;
  let lastStringStart: { line: number | null, column: number | null } = { line: null, column: null };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      for (let charIndex = 0; charIndex < line.length; charIndex++) {
          const char = line[charIndex];
          if (escaped) { escaped = false; continue; }
          if (char === '\\' && inString) { escaped = true; continue; }
          if ((char === '"' || char === "'") && !inString) {
              inString = true; stringChar = char;
              lastStringStart = { line: lineIndex + 1, column: charIndex + 1 };
          } else if (char === stringChar && inString) { inString = false; }
      }
  }
  if (inString && lastStringStart.line !== null) {
      // Return line/column, context will be built by the caller
      return { ...lastStringStart, context: '' };
  }
  return { line: null, column: null, context: '' };
}


export function attemptAdvancedFix(jsonString: string): FixAttempt {
  let fixed = jsonString;
  const allFixes = new Set<string>();
  
  const generalFix = applyGeneralFixes(fixed);
  if (generalFix.fixes.length > 0) {
    fixed = generalFix.fixed;
    generalFix.fixes.forEach(fix => allFixes.add(fix));
  }
  
  try {
    const parsed = JSON.parse(fixed);
    return { success: true, fixed: JSON.stringify(parsed, null, 2), suggestions: Array.from(allFixes) };
  } catch (error) {
    let finalSuggestions = Array.from(allFixes);
    if ((error as Error).message.includes('Unterminated string')) {
      finalSuggestions.push('Attempted to fix an unterminated string. Please review the result.');
    }
    if (finalSuggestions.length === 0) {
      finalSuggestions.push('Could not automatically fix JSON errors.');
    }
    return { success: false, fixed: null, suggestions: finalSuggestions };
  }
}

export function fixSmartQuotes(str: string): string {
    // Replaces all typographic quotes (single and double) with standard double quotes.
    return str.replace(/[\u2018\u2019\u201C\u201D]/g, '"');
}

export function applyGeneralFixes(jsonString: string): { fixed: string, fixes: string[] } {
  const fixes: string[] = [];
  let fixed = jsonString.trim();

  const initialFixed = fixed;
  fixed = fixSmartQuotes(fixed);
  if (initialFixed !== fixed) fixes.push('Replaced smart/typographic quotes with standard double quotes');
  
  const fixOperations: FixOperation[] = [
    { regex: /(:\s*)=/g, replacement: '$1', description: 'Replaced invalid assignment operator (e.g. `:=`) with a colon' },
    { regex: /,\s*([}\]])/g, replacement: '$1', description: 'Removed trailing commas' },
    { regex: /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, replacement: '$1"$2":', description: 'Added quotes to unquoted keys' },
    { regex: /:\s*([^",\s\[\{][^,}\]]*?)(?=\s*[,}])/g, replacement: ': "$1"', description: 'Added quotes to an unquoted string value' },
    { regex: /:\s*(undefined|NaN|Infinity|-Infinity)/g, replacement: ': null', description: 'Replaced `undefined`, `NaN`, or `Infinity` with `null`' },
    { regex: /"(\s*)"(?!\s*[:],}])/g, replacement: '","', description: 'Added missing comma between string values' },
    { regex: /}(\s*)"/g, replacement: '},"$1"', description: 'Added missing comma between an object and a following key' },
    { regex: /\](\s*)"/g, replacement: '],"$1"', description: 'Added missing comma between an array and a following key' },
    { regex: /\](\s*)\{/g, replacement: '], $1{', description: 'Added missing comma between an array and an object' },
  ];
  
  // Apply multiple passes for some fixes
  for(let i = 0; i < 3; i++) {
    fixOperations.forEach(op => {
        const before = fixed;
        fixed = fixed.replace(op.regex, op.replacement);
        if (before !== fixed && !fixes.includes(op.description)) fixes.push(op.description);
    });
  }

  return { fixed, fixes };
}
