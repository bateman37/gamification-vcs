import { CreateSplitForm } from "./CreateSplitForm";

export default function NuevoSplitPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Crear split</h1>
        <p className="text-sm text-text-muted">
          El split se guardara en borrador. Podras anadir participantes y activarlo desde su pagina de
          detalle.
        </p>
      </div>
      <CreateSplitForm />
    </div>
  );
}
