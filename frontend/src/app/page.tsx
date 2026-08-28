"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FileImage, FileSpreadsheet, UploadCloud, X } from "lucide-react";

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
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAnalyze = merchantName.trim().length > 0 && files.length > 0;

  function acceptFiles(candidates: FileList | File[] | undefined | null) {
    if (!candidates || candidates.length === 0) return;

    const incoming = Array.from(candidates);
    const accepted = incoming.filter(isAcceptedFile);
    const rejected = incoming.filter((candidate) => !isAcceptedFile(candidate));

    if (accepted.length > 0) {
      setFiles((prev) => [...prev, ...accepted]);
    }

    if (rejected.length > 0) {
      setError(
        rejected.length === 1
          ? `"${rejected[0].name}" is not a supported file type. Only JPG, PNG, and CSV files are supported.`
          : `${rejected.length} files are not a supported file type. Only JPG, PNG, and CSV files are supported.`,
      );
    } else {
      setError(null);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFiles(event.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
    acceptFiles(event.dataTransfer.files);
  }

  function handleRemoveFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!merchantName.trim()) {
      setError("Enter the merchant's business name.");
      return;
    }
    if (files.length === 0) {
      setError("Select at least one receipt image or CSV file to continue.");
      return;
    }

    const applicationId = generateApplicationId();

    // No backend yet: stash what the processing page needs to display
    // (merchant name + file metadata, never the file contents) so this
    // stage stays entirely client-side.
    sessionStorage.setItem(
      `flume:application:${applicationId}`,
      JSON.stringify({
        merchantName: merchantName.trim(),
        files: files.map((selected) => ({
          name: selected.name,
          type: selected.type,
          size: selected.size,
        })),
        createdAt: new Date().toISOString(),
      }),
    );

    router.push(`/processing/${applicationId}`);
  }

  return (
    <main className="flex flex-1 justify-center px-6 py-12 sm:px-8 sm:py-16 lg:py-24">
      <div className="mx-auto flex w-full max-w-content flex-col items-center">
        <header className="flex flex-col items-center gap-2 text-center">
          <span className="text-2xl font-bold tracking-tight text-foreground">Flume</span>
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

          <div className="flex flex-col gap-3">
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
                multiple
                onChange={handleInputChange}
                className="sr-only"
              />

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
                  Drag and drop receipt images or CSV files here, or browse your files.
                </span>
                <span className="text-xs text-foreground-muted">JPG, PNG, CSV</span>
              </label>
            </div>

            {files.length > 0 && (
              <ul className="flex flex-col gap-2">
                {files.map((selected, index) => {
                  const FileTypeIcon = isCsvFile(selected) ? FileSpreadsheet : FileImage;
                  return (
                    <li
                      key={`${selected.name}-${selected.size}-${index}`}
                      className="flex items-center justify-between gap-4 rounded-button border border-border bg-surface-alt px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button bg-accent/10 text-accent">
                          <FileTypeIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {selected.name}
                          </p>
                          <p className="text-xs text-foreground-muted">
                            {selected.type || "Unknown type"} · {formatFileSize(selected.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        aria-label={`Remove ${selected.name}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-button text-foreground-muted transition-colors duration-200 hover:bg-surface hover:text-foreground"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
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
