import { useRef, useState } from "react";

interface FileUploadZoneProps {
  accept?: string;
  onFile: (file: File) => void;
  isLoading?: boolean;
  label?: string;
}

export default function FileUploadZone({
  accept = ".pdf,.docx,.doc",
  onFile,
  isLoading = false,
  label = "Upload CV",
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    onFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !isLoading && inputRef.current?.click()}
      className={`
        relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
        ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"}
        ${isLoading ? "opacity-60 cursor-not-allowed" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        disabled={isLoading}
      />

      {isLoading ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Extracting information...</p>
        </div>
      ) : fileName ? (
        <div className="flex flex-col items-center gap-2">
          <span className="text-3xl">📄</span>
          <p className="text-sm font-medium text-gray-800">{fileName}</p>
          <p className="text-xs text-gray-400">Click to change file</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl">☁️</span>
          <p className="text-sm font-semibold text-gray-700">{label}</p>
          <p className="text-xs text-gray-400">Drag & drop or click to browse</p>
          <p className="text-xs text-gray-400">Supports PDF, DOCX, DOC</p>
        </div>
      )}
    </div>
  );
}
