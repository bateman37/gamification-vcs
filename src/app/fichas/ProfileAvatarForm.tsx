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
    <SubmitButton pending={pending} className="bg-slate-700 hover:bg-slate-600">
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
      className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
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
        <label htmlFor={`avatar-${splitParticipantId}`} className="block text-xs font-medium text-slate-600">
          {hasAvatar ? "Reemplazar avatar" : "Subir avatar"}
        </label>
        <input
          id={`avatar-${splitParticipantId}`}
          name="avatar"
          type="file"
          accept={AVATAR_ACCEPT_ATTRIBUTE}
          onChange={handleFileChange}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
        />
        <p className="text-xs text-slate-500">
          JPEG, PNG o WebP. Maximo 5 MB. La imagen se recorta a {AVATAR_MAX_DIMENSION} px como maximo por lado, se elimina
          su informacion EXIF y se guarda en formato WebP.
        </p>
        {previewUrl && (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- previsualizacion local del archivo elegido (blob:), nunca una URL remota. */}
            <img src={previewUrl} alt="Previsualizacion del avatar elegido" className="h-16 w-16 rounded-full border border-slate-200 object-cover" />
            <span className="text-xs text-slate-500">Previsualizacion (todavia sin guardar).</span>
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
