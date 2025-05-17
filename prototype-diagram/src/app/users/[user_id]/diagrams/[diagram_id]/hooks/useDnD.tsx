"use client";

import {
  createContext,
  useContext,
  useState,
  Dispatch,
  SetStateAction,
} from "react";

const DnDContext = createContext<
  [string | null, Dispatch<SetStateAction<string | null>>]
>([null, () => {}]);

export const DnDProvider = ({children}: any) => {
  const [type, setType] = useState<string | null>(null);

  return (
    <DnDContext.Provider value={[type, setType]}>
      {children}
    </DnDContext.Provider>
  );
};

export default DnDContext;

export const useDnD = (): [
  string | null,
  Dispatch<SetStateAction<string | null>>
] => {
  return useContext(DnDContext);
};
