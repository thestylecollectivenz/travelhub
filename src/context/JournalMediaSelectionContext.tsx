import * as React from 'react';

export interface JournalMediaSelectionContextValue {
  selectedPhotoId: string | null;
  setSelectedPhotoId: (id: string | null) => void;
}

const JournalMediaSelectionContext = React.createContext<JournalMediaSelectionContextValue | undefined>(undefined);

export const JournalMediaSelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedPhotoId, setSelectedPhotoId] = React.useState<string | null>(null);
  const value = React.useMemo(
    (): JournalMediaSelectionContextValue => ({ selectedPhotoId, setSelectedPhotoId }),
    [selectedPhotoId]
  );
  return <JournalMediaSelectionContext.Provider value={value}>{children}</JournalMediaSelectionContext.Provider>;
};

export function useJournalMediaSelection(): JournalMediaSelectionContextValue {
  const ctx = React.useContext(JournalMediaSelectionContext);
  if (!ctx) {
    throw new Error('useJournalMediaSelection must be used within JournalMediaSelectionProvider');
  }
  return ctx;
}
