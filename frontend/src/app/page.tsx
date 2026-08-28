"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Droplets, FileImage, FileSpreadsheet, UploadCloud, X } from "lucide-react";

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "text/csv"];
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".csv"];
const ACCEPT_ATTRIBUTE = "image/jpeg,image/png,.csv";

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.includes(file.type)) return true;
  // CSV files are sometimes reported with no MIME type (or a spreadsheet
  // vendor type) depending on OS/browser, so fall back to the extension.
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function isCsvFile(file: File): boolean {
  return file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function generateApplicationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `app_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [merchantName, setMerchantName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAnalyze = merchantName.trim().length > 0 && file !== null;

  function acceptFile(candidate: File | undefined | null) {
    if (!candidate) return;
    if (!isAcceptedFile(candidate)) {
      setError("Only JPG, PNG, and CSV files are supported.");
      return;
    }
    setError(null);
    setFile(candidate);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0]);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  }

  function handleRemoveFile() {
    setFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!merchantName.trim()) {
      setError("Enter the merchant's business name.");
      return;
    }
    if (!file) {
      setError("Select a receipt image or CSV file to continue.");
      return;
    }

    const applicationId = generateApplicationId();

    // No backend yet: stash what the processing page needs to display
    // (merchant name + filename only, never the file itself) so this
    // stage stays entirely client-side.
    sessionStorage.setItem(
      `flume:application:${applicationId}`,
      JSON.stringify({
        merchantName: merchantName.trim(),
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        createdAt: new Date().toISOString(),
      }),
    );

    router.push(`/processing/${applicationId}`);
  }

  const FileTypeIcon = file && isCsvFile(file) ? FileSpreadsheet : FileImage;

  return (
    <main className="flex flex-1 justify-center px-6 py-12 sm:px-8 sm:py-16 lg:py-24">
      <div className="mx-auto flex w-full max-w-content flex-col items-center">
        <header className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-badge bg-accent/10 text-accent">
              <Droplets className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight text-foreground">Flume</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
            AI Credit Underwriting
          </p>
        </header>

        <div className="mt-12 max-w-2xl text-center sm:mt-16">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Upload Financial Records
          </h1>
          <p className="mt-4 text-base leading-relaxed text-foreground-secondary sm:text-lg">
            Upload a merchant&apos;s receipts or transaction records to begin an AI-powered
            underwriting analysis.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-10 flex w-full max-w-2xl flex-col gap-8 rounded-card border border-border bg-surface p-6 shadow-large sm:mt-12 sm:p-8"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="merchant-name" className="text-sm font-semibold text-foreground">
              Merchant name
            </label>
            <input
              id="merchant-name"
              name="merchant-name"
              type="text"
              value={merchantName}
              onChange={(event) => setMerchantName(event.target.value)}
              placeholder="e.g. Kingston Market Ltd."
              autoComplete="off"
              className="rounded-button border border-border bg-surface-alt px-4 py-3 text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-foreground-muted focus:border-accent"
            />
            <p className="text-xs text-foreground-muted">Enter the business being assessed.</p>
          </div>

          <div className="flex flex-col gap-2">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-card border border-dashed transition-colors duration-200 ${
                isDragging
                  ? "border-accent bg-surface-alt"
                  : "border-border bg-surface-alt/60"
              }`}
            >
              <input
                ref={fileInputRef}
                id="file-upload"
                name="file-upload"
                type="file"
                accept={ACCEPT_ATTRIBUTE}
                onChange={handleInputChange}
                className="sr-only"
              />

              {!file ? (
                <label
                  htmlFor="file-upload"
                  className="flex cursor-pointer flex-col items-center gap-3 px-6 py-10 text-center transition-colors duration-200 hover:border-accent"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <UploadCloud className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    Upload financial records
                  </span>
                  <span className="max-w-xs text-sm text-foreground-secondary">
                    Drag and drop a receipt image or CSV file here, or browse your files.
                  </span>
                  <span className="text-xs text-foreground-muted">JPG, PNG, CSV</span>
                </label>
              ) : (
                <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button bg-accent/10 text-accent">
                      <FileTypeIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
                      <p className="text-xs text-foreground-muted">
                        {file.type || "Unknown type"} · {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    aria-label={`Remove ${file.name}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-button text-foreground-muted transition-colors duration-200 hover:bg-surface hover:text-foreground"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canAnalyze}
            className="rounded-button bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-surface-alt disabled:text-foreground-muted"
          >
            Analyze Records
          </button>
        </form>
      </div>
    </main>
  );
}
