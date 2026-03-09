import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import { ToastContainer } from "../ui/Toast";
import { useToast } from "../ui/Toast";
import { createContext, useContext } from "react";
import type { ToastType } from "../ui/Toast";

interface ToastContextValue {
  toast: (msg: string, type?: ToastType) => void;
}

export const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useAppToast() {
  return useContext(ToastContext);
}

interface Props {
  children: ReactNode;
  title?: string;
}

export default function Layout({ children, title }: Props) {
  const { toasts, addToast, removeToast } = useToast();

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0">
          {title && (
            <header className="bg-white border-b border-gray-200 px-8 py-5">
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            </header>
          )}
          <div className="flex-1 px-8 py-6">{children}</div>
        </main>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}
