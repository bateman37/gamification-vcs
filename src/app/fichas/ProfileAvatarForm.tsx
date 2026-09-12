"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { deleteOwnAvatarAction, saveOwnAvatarAction } from "@/server/actions/profile.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton, SuccessMessage } from "@/components/ui";
import { AVATAR_ACCEPT_ATTRIBUTE, AVATAR_MAX_DIMENSION } from "@/domain/avatar-constraints";

function UploadAvatarButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <SubmitButton pending={pending} className="bg-ink/90 hover:bg-ink/80">
      {label}
    </SubmitButton>
  );
}

function DeleteAvatarButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-control border border-danger/30 px-3 py-2 text-sm font-medium text-danger-ink hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Eliminando..." : "Eliminar avatar"}
    </button>
  );
}

/**
 * Subida, previsualizacion, reemplazo y borrado del avatar propio (`0.8.0` /
 * MVP-2B). La previsualizacion es local (`URL.createObjectURL`) y solo sirve
 * para ver el archivo elegido antes de guardarlo: la validacion real (5 MB,
 * formato decodificado, redimension a 512 px, salida WebP sin EXIF) ocurre
 * siempre en servidor.
 */
export function ProfileAvatarForm({
  splitParticipantId,
  hasAvatar,
}: {
  splitParticipantId: string;
  hasAvatar: boolean;
}) {
  const saveWithId = saveOwnAvatarAction.bind(null, splitParticipantId);
  const [saveState, saveAction] = useFormState(saveWithId, initialActionState);
  const deleteWithId = deleteOwnAvatarAction.bind(null, splitParticipantId);
  const [deleteState, deleteAction] = useFormState(deleteWithId, initialActionState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previousUrl = useRef<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (previousUrl.current) URL.revokeObjectURL(previousUrl.current);
    const file = event.target.files?.[0];
    if (!file) {
      previousUrl.current = null;
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    previousUrl.current = url;
    setPreviewUrl(url);
  }

  return (
    <div className="space-y-2">
      <form action={saveAction} className="space-y-2">
        <label htmlFor={`avatar-${splitParticipantId}`} className="block text-xs font-medium text-text-muted">
          {hasAvatar ? "Reemplazar avatar" : "Subir avatar"}
        </label>
        <input
          id={`avatar-${splitParticipantId}`}
          name="avatar"
          type="file"
          accept={AVATAR_ACCEPT_ATTRIBUTE}
          onChange={handleFileChange}
          className="block w-full text-sm text-text-muted file:mr-3 file:rounded-control file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
        />
        <p className="text-xs text-text-muted">
          JPEG, PNG o WebP. Máximo 5 MB. La imagen se recorta a {AVATAR_MAX_DIMENSION} px como maximo por lado, se elimina
          su informacion EXIF y se guarda en formato WebP.
        </p>
        {previewUrl && (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- previsualizacion local del archivo elegido (blob:), nunca una URL remota. */}
            <img src={previewUrl} alt="Previsualizacion del avatar elegido" className="h-16 w-16 rounded-full border border-border object-cover" />
            <span className="text-xs text-text-muted">Previsualización (todavía sin guardar).</span>
          </div>
        )}
        <UploadAvatarButton label={hasAvatar ? "Reemplazar" : "Subir"} />
        <FieldError message={saveState.fieldErrors?.avatar} />
        {!saveState.ok && saveState.error && <ErrorMessage>{saveState.error}</ErrorMessage>}
        {saveState.ok && <SuccessMessage>Avatar guardado.</SuccessMessage>}
      </form>

      {hasAvatar && (
        <form action={deleteAction}>
          <DeleteAvatarButton />
          {!deleteState.ok && deleteState.error && <ErrorMessage>{deleteState.error}</ErrorMessage>}
          {deleteState.ok && <SuccessMessage>Avatar eliminado.</SuccessMessage>}
        </form>
      )}
    </div>
  );
}
