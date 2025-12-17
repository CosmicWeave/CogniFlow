
const ALGORITHM = 'AES-GCM';
const SALT_LEN = 16;
const IV_LEN = 12;

// Derive a key from a password
async function getKey(password: string, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: ALGORITHM, length: 256 },
        false,
        usage
    );
}

export async function encryptData(data: string, password: string): Promise<string> {
    const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LEN));
    const key = await getKey(password, salt, ["encrypt"]);
    const enc = new TextEncoder();
    
    const encrypted = await window.crypto.subtle.encrypt(
        { name: ALGORITHM, iv: iv },
        key,
        enc.encode(data)
    );
    
    // Combine salt + iv + ciphertext for storage
    // Format: base64(salt + iv + ciphertext)
    const combined = new Uint8Array(salt.byteLength + iv.byteLength + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.byteLength);
    combined.set(new Uint8Array(encrypted), salt.byteLength + iv.byteLength);
    
    // Use standard btoa. For large data, this might be slow, but backups are moderate size.
    // Chunking logic can be added later if needed.
    let binary = '';
    for (let i = 0; i < combined.byteLength; i++) {
        binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
}

export async function decryptData(encryptedBase64: string, password: string): Promise<string> {
    const binaryString = atob(encryptedBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    if (bytes.byteLength < SALT_LEN + IV_LEN) {
        throw new Error("Invalid encrypted data.");
    }
    
    const salt = bytes.slice(0, SALT_LEN);
    const iv = bytes.slice(SALT_LEN, SALT_LEN + IV_LEN);
    const data = bytes.slice(SALT_LEN + IV_LEN);
    
    const key = await getKey(password, salt, ["decrypt"]);
    
    try {
        const decrypted = await window.crypto.subtle.decrypt(
            { name: ALGORITHM, iv: iv },
            key,
            data
        );
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        throw new Error("Decryption failed. Wrong password or corrupted data.");
    }
}
