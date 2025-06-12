"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Progress } from "@/components/ui/progress"
import { ImportExportManager, type ImportPreview, type ImportResult } from "@/lib/import-export"
import { Download, Upload, AlertTriangle, CheckCircle, X } from "lucide-react"

interface ImportExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete?: () => void
}

type DialogMode = "menu" | "export" | "import" | "preview" | "importing" | "result"

export default function ImportExportDialog({ open, onOpenChange, onImportComplete }: ImportExportDialogProps) {
  const [mode, setMode] = useState<DialogMode>("menu")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressStatus, setProgressStatus] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // Import options
  const [importNotes, setImportNotes] = useState(true)
  const [importSettings, setImportSettings] = useState(true)
  const [mergeMode, setMergeMode] = useState<"merge" | "overwrite">("merge")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const resetState = () => {
    setMode("menu")
    setSelectedFile(null)
    setImportPreview(null)
    setImportResult(null)
    setProgress(0)
    setProgressStatus("")
    setError(null)
    setShowConfirmDialog(false)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

  const handleClose = () => {
    resetState()
    onOpenChange(false)
  }

  const handleExport = async () => {
    setMode("export")
    setProgress(0)
    setError(null)

    try {
      const result = await ImportExportManager.exportAllData((progress, status) => {
        setProgress(progress)
        setProgressStatus(status)
      })

      if (result.success) {
        setProgressStatus(`Export complete! Downloaded: ${result.filename}`)
        setTimeout(() => {
          handleClose()
        }, 2000)
      } else {
        setError(result.error || "Export failed")
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Export failed")
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      handlePreviewImport(file)
    }
  }

  const handlePreviewImport = async (file: File) => {
    setMode("preview")
    setError(null)

    try {
      const preview = await ImportExportManager.previewImport(file)
      setImportPreview(preview)

      if (preview.errors.length > 0) {
        setError(preview.errors.join(", "))
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to preview import")
    }
  }

  const handleImportConfirm = () => {
    if (mergeMode === "overwrite") {
      setShowConfirmDialog(true)
    } else {
      startImport()
    }
  }

  const startImport = async () => {
    if (!selectedFile) return

    setMode("importing")
    setProgress(0)
    setError(null)
    setShowConfirmDialog(false)

    abortControllerRef.current = new AbortController()

    try {
      const result = await ImportExportManager.importData(
        selectedFile,
        { mergeMode, importNotes, importSettings },
        (progress, status) => {
          setProgress(progress)
          setProgressStatus(status)
        },
        abortControllerRef.current.signal,
      )

      setImportResult(result)
      setMode("result")

      if (result.success) {
        onImportComplete?.()
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Import failed")
      setMode("result")
    }
  }

  const handleCancelImport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const renderContent = () => {
    switch (mode) {
      case "menu":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-theme-text">Import & Export</DialogTitle>
              <DialogDescription className="text-theme-text-muted">
                Backup your notes or import from another device
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Button
                onClick={handleExport}
                className="w-full justify-start h-auto p-4 bg-theme-card-accent hover:bg-theme-card-accent-hover border border-theme-border"
                variant="outline"
              >
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5 text-theme-primary" />
                  <div className="text-left">
                    <div className="font-medium text-theme-text">Export All Notes</div>
                    <div className="text-sm text-theme-text-muted">Download all your notes and settings as JSON</div>
                  </div>
                </div>
              </Button>

              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full justify-start h-auto p-4 bg-theme-card-accent hover:bg-theme-card-accent-hover border border-theme-border"
                variant="outline"
              >
                <div className="flex items-center gap-3">
                  <Upload className="h-5 w-5 text-theme-primary" />
                  <div className="text-left">
                    <div className="font-medium text-theme-text">Import Notes</div>
                    <div className="text-sm text-theme-text-muted">Import notes from a JSON backup file</div>
                  </div>
                </div>
              </Button>

              <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
            </div>
          </>
        )

      case "export":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-theme-text">Exporting Notes</DialogTitle>
              <DialogDescription className="text-theme-text-muted">
                Please wait while we prepare your backup file
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-theme-text-muted text-center">{progressStatus}</p>
              {error && (
                <div className="p-3 rounded-lg border-2 error-message">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )

      case "preview":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-theme-text">Import Preview</DialogTitle>
              <DialogDescription className="text-theme-text-muted">
                Review what will be imported from {selectedFile?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error ? (
                <div className="p-3 rounded-lg border-2 error-message">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                </div>
              ) : importPreview ? (
                <>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-theme-card-accent rounded-lg border border-theme-border">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-theme-text">{importPreview.totalNotes}</div>
                      <div className="text-sm text-theme-text-muted">Total Notes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-theme-text">{importPreview.settings.length}</div>
                      <div className="text-sm text-theme-text-muted">Settings</div>
                    </div>
                  </div>

                  {importPreview.existingNotes > 0 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-700">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        <span className="text-sm text-yellow-800 dark:text-yellow-200">
                          {importPreview.existingNotes} notes already exist and may be overwritten
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-theme-text-muted">Import Options</Label>
                      <div className="space-y-2 mt-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox id="import-notes" checked={importNotes} onCheckedChange={setImportNotes} />
                          <Label htmlFor="import-notes" className="text-sm text-theme-text">
                            Import Notes ({importPreview.totalNotes})
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="import-settings" checked={importSettings} onCheckedChange={setImportSettings} />
                          <Label htmlFor="import-settings" className="text-sm text-theme-text">
                            Import Settings ({importPreview.settings.length})
                          </Label>
                        </div>
                      </div>
                    </div>

                    {importPreview.existingNotes > 0 && (
                      <div>
                        <Label className="text-sm font-medium text-theme-text-muted">Conflict Resolution</Label>
                        <RadioGroup
                          value={mergeMode}
                          onValueChange={(value) => setMergeMode(value as "merge" | "overwrite")}
                          className="mt-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="merge" id="merge" />
                            <Label htmlFor="merge" className="text-sm text-theme-text">
                              Merge (keep existing notes, add new ones)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="overwrite" id="overwrite" />
                            <Label htmlFor="overwrite" className="text-sm text-theme-text">
                              Overwrite (replace existing notes)
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setMode("menu")} className="btn-theme-outline">
                Back
              </Button>
              {importPreview && !error && (
                <Button
                  onClick={handleImportConfirm}
                  disabled={!importNotes && !importSettings}
                  className="bg-theme-primary text-theme-primary-foreground hover:bg-theme-primary/90"
                >
                  Import
                </Button>
              )}
            </DialogFooter>
          </>
        )

      case "importing":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-theme-text">Importing Notes</DialogTitle>
              <DialogDescription className="text-theme-text-muted">
                Please wait while we import your data
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-theme-text-muted text-center">{progressStatus}</p>
              <div className="flex justify-center">
                <Button variant="outline" onClick={handleCancelImport} className="btn-theme-outline">
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          </>
        )

      case "result":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-theme-text">Import Complete</DialogTitle>
              <DialogDescription className="text-theme-text-muted">
                {importResult?.success ? "Your data has been imported successfully" : "Import encountered some issues"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {importResult?.success ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-700">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="font-medium text-green-800 dark:text-green-200">Import Successful</span>
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    <div>Notes imported: {importResult.imported.notes}</div>
                    <div>Settings imported: {importResult.imported.settings}</div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-700">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <span className="font-medium text-red-800 dark:text-red-200">Import Failed</span>
                  </div>
                  {importResult?.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-700 dark:text-red-300">
                      {error}
                    </div>
                  ))}
                </div>
              )}

              {importResult?.warnings && importResult.warnings.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-700">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    <span className="font-medium text-yellow-800 dark:text-yellow-200">Warnings</span>
                  </div>
                  {importResult.warnings.map((warning, index) => (
                    <div key={index} className="text-sm text-yellow-700 dark:text-yellow-300">
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg border-2 error-message">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                onClick={handleClose}
                className="bg-theme-primary text-theme-primary-foreground hover:bg-theme-primary/90"
              >
                Close
              </Button>
            </DialogFooter>
          </>
        )

      default:
        return null
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-theme-card border-theme-border max-w-md">{renderContent()}</DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="bg-theme-card border-theme-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-theme-text">Confirm Overwrite</AlertDialogTitle>
            <AlertDialogDescription className="text-theme-text-muted">
              You've selected "Overwrite" mode. This will replace existing notes with the same IDs from the import file.
              This action cannot be undone. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={startImport} className="bg-red-600 hover:bg-red-700">
              Overwrite Notes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
