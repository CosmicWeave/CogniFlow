import React, { createContext, useContext } from 'react';
// FIX: Corrected import path for useDataManagement
import { useDataManagement } from '../hooks/useDataManagement';

// The type for the context value will be the return type of our hook.
// This ensures type safety when we consume the context.
type DataManagementContextType = ReturnType<typeof useDataManagement> | null;

const DataManagementContext = createContext<DataManagementContextType>(null);

// Custom hook to easily consume the context
export const useData = () => {
    const context = useContext(DataManagementContext);
    if (!context) {
        throw new Error("useData must be used within a DataManagementProvider");
    }
    return context;
};

// The provider component will be used in App.tsx to wrap the application.
// It instantiates the data management hook itself and provides the handlers to its children.
export const DataManagementProvider: React.FC<{
    children: React.ReactNode;
    value: DataManagementContextType;
}> = ({ children, value }) => {
    return (
        <DataManagementContext.Provider value={value}>
            {children}
        </DataManagementContext.Provider>
    );
};