/**
 * Estado comun de los formularios con Server Actions (`useFormState`). Vive
 * en un modulo sin `"use server"` a proposito: un archivo `"use server"`
 * solo puede exportar funciones async, y `initialSimpleActionState` es un
 * valor, no una funcion.
 */
export interface SimpleActionState {
  ok: boolean;
  error?: string;
  saved?: boolean;
}

export const initialSimpleActionState: SimpleActionState = { ok: true };
