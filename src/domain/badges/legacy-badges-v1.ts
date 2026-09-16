/**
 * Historico canonico `legacy-badges-v1` (`1.2.3`, seccion 4/apendice A del
 * encargo, ver docs/BADGES.md). Transcripcion literal, normalizada y
 * versionada del historico real de los 9 Splits anteriores: exactamente 127
 * concesiones individuales de 18 personas distintas. El Excel original no es
 * una dependencia de produccion; esta es la unica fuente que usa el
 * importador (`badge-historical.service.ts`), y se puede restaurar sobre
 * una base de datos completamente vacia con solo este repositorio.
 *
 * No se guardan fechas: el encargo prohibe expresamente inventarlas cuando
 * el origen no las tiene. `splitLabel` es siempre el texto literal
 * "Split N"; el numero no se corresponde con ningun `Split.id` real.
 * `categoryLabel` es el nombre de la categoria tal como aparece en el
 * historico (incluye el caso "MVP Team" tal como se transcribe aqui; el
 * importador tambien reconoce el alias "Team MVP" del Excel original, ver
 * `resolveBadgeCodeForCategoryLabel`). Los nombres repetidos dentro de la
 * misma categoria y split son concesiones individuales distintas, nunca un
 * acumulado deducido.
 */

export const LEGACY_BADGES_VERSION = "legacy-badges-v1";

export interface LegacyBadgeGrant {
  splitLabel: string;
  categoryLabel: string;
  recipientName: string;
}

export const LEGACY_BADGE_GRANTS: readonly LegacyBadgeGrant[] = [
  // Split 1
  { splitLabel: "Split 1", categoryLabel: "Cazador de soluciones", recipientName: "Daniela Duarte" },
  { splitLabel: "Split 1", categoryLabel: "Explorador de datos", recipientName: "Oriol Romero" },
  { splitLabel: "Split 1", categoryLabel: "Embajador de voz", recipientName: "Daniela Duarte" },
  { splitLabel: "Split 1", categoryLabel: "Maestro Artesano", recipientName: "Teresa Perez" },
  { splitLabel: "Split 1", categoryLabel: "Redactor estrella", recipientName: "Cristina Tarrés" },
  { splitLabel: "Split 1", categoryLabel: "Estudiante entusiasta", recipientName: "Cristina Tarrés" },
  { splitLabel: "Split 1", categoryLabel: "Estudiante entusiasta", recipientName: "Teresa Perez" },
  { splitLabel: "Split 1", categoryLabel: "Aprendiz experto", recipientName: "Xabier Aznar" },
  { splitLabel: "Split 1", categoryLabel: "Guardián del conocimiento", recipientName: "Luciano Moreira" },
  { splitLabel: "Split 1", categoryLabel: "MVP", recipientName: "Cristina Tarrés" },

  // Split 2
  { splitLabel: "Split 2", categoryLabel: "Cazador de soluciones", recipientName: "Arnau Titos" },
  { splitLabel: "Split 2", categoryLabel: "Explorador de datos", recipientName: "Oriol Romero" },
  { splitLabel: "Split 2", categoryLabel: "Embajador de voz", recipientName: "Martina Lattus" },
  { splitLabel: "Split 2", categoryLabel: "Maestro Artesano", recipientName: "Arnau Titos" },
  { splitLabel: "Split 2", categoryLabel: "Redactor estrella", recipientName: "Teresa Perez" },
  { splitLabel: "Split 2", categoryLabel: "Estudiante entusiasta", recipientName: "David Masnou" },
  { splitLabel: "Split 2", categoryLabel: "Aprendiz experto", recipientName: "Teresa Perez" },
  { splitLabel: "Split 2", categoryLabel: "Guardián del conocimiento", recipientName: "Luciano Moreira" },
  { splitLabel: "Split 2", categoryLabel: "MVP", recipientName: "Teresa Perez" },

  // Split 3
  { splitLabel: "Split 3", categoryLabel: "Cazador de soluciones", recipientName: "Arnau Titos" },
  { splitLabel: "Split 3", categoryLabel: "Explorador de datos", recipientName: "Iban Saenz" },
  { splitLabel: "Split 3", categoryLabel: "Embajador de voz", recipientName: "Martina Lattus" },
  { splitLabel: "Split 3", categoryLabel: "Maestro Artesano", recipientName: "Arnau Titos" },
  { splitLabel: "Split 3", categoryLabel: "Cronomagia laboral", recipientName: "Martina Lattus" },
  { splitLabel: "Split 3", categoryLabel: "Travesía del Padawan", recipientName: "David Masnou" },
  { splitLabel: "Split 3", categoryLabel: "Guardián de la Estabilidad", recipientName: "Oriol Romero" },
  { splitLabel: "Split 3", categoryLabel: "Redactor estrella", recipientName: "Luciano Moreira" },
  { splitLabel: "Split 3", categoryLabel: "Estudiante entusiasta", recipientName: "Teresa Perez" },
  { splitLabel: "Split 3", categoryLabel: "Aprendiz experto", recipientName: "David Masnou" },
  { splitLabel: "Split 3", categoryLabel: "MVP", recipientName: "Martina Lattus" },
  { splitLabel: "Split 3", categoryLabel: "MVP Team", recipientName: "David Oliva" },
  { splitLabel: "Split 3", categoryLabel: "MVP Team", recipientName: "David Masnou" },
  { splitLabel: "Split 3", categoryLabel: "MVP Team", recipientName: "Xabier Aznar" },
  { splitLabel: "Split 3", categoryLabel: "MVP Team", recipientName: "Teresa Perez" },
  { splitLabel: "Split 3", categoryLabel: "MVP Team", recipientName: "Vanesa Vasquez" },

  // Split 4
  { splitLabel: "Split 4", categoryLabel: "Cazador de soluciones", recipientName: "Daniela Duarte" },
  { splitLabel: "Split 4", categoryLabel: "Explorador de datos", recipientName: "Oriol Romero" },
  { splitLabel: "Split 4", categoryLabel: "Embajador de voz", recipientName: "Daniela Duarte" },
  { splitLabel: "Split 4", categoryLabel: "Maestro Artesano", recipientName: "Arnau Titos" },
  { splitLabel: "Split 4", categoryLabel: "Cronomagia laboral", recipientName: "David Masnou" },
  { splitLabel: "Split 4", categoryLabel: "Guardián de la Estabilidad", recipientName: "Oriol Romero" },
  { splitLabel: "Split 4", categoryLabel: "Redactor estrella", recipientName: "Oriol Romero" },
  { splitLabel: "Split 4", categoryLabel: "Redactor estrella", recipientName: "Cristina Tarrés" },
  { splitLabel: "Split 4", categoryLabel: "Redactor estrella", recipientName: "Xabier Aznar" },
  { splitLabel: "Split 4", categoryLabel: "Redactor estrella", recipientName: "Luciano Moreira" },
  { splitLabel: "Split 4", categoryLabel: "Estudiante entusiasta", recipientName: "Xabier Aznar" },
  { splitLabel: "Split 4", categoryLabel: "Aprendiz experto", recipientName: "Oriol Romero" },
  { splitLabel: "Split 4", categoryLabel: "MVP", recipientName: "Xabier Aznar" },
  { splitLabel: "Split 4", categoryLabel: "MVP Team", recipientName: "David Oliva" },
  { splitLabel: "Split 4", categoryLabel: "MVP Team", recipientName: "Oriol Romero" },
  { splitLabel: "Split 4", categoryLabel: "MVP Team", recipientName: "Cristina Tarrés" },
  { splitLabel: "Split 4", categoryLabel: "MVP Team", recipientName: "Diego Pereira" },
  { splitLabel: "Split 4", categoryLabel: "MVP Team", recipientName: "Arnau Titos" },

  // Split 5
  { splitLabel: "Split 5", categoryLabel: "Cazador de soluciones", recipientName: "Teresa Perez" },
  { splitLabel: "Split 5", categoryLabel: "Explorador de datos", recipientName: "Oriol Romero" },
  { splitLabel: "Split 5", categoryLabel: "Embajador de voz", recipientName: "Daniela Duarte" },
  { splitLabel: "Split 5", categoryLabel: "Maestro Artesano", recipientName: "Luciano Moreira" },
  { splitLabel: "Split 5", categoryLabel: "Cronomagia laboral", recipientName: "David Masnou" },
  { splitLabel: "Split 5", categoryLabel: "Guardián de la Estabilidad", recipientName: "Oriol Romero" },
  { splitLabel: "Split 5", categoryLabel: "Redactor estrella", recipientName: "Cristina Tarrés" },
  { splitLabel: "Split 5", categoryLabel: "Estudiante entusiasta", recipientName: "Cristina Tarrés" },
  { splitLabel: "Split 5", categoryLabel: "Aprendiz experto", recipientName: "Oriol Romero" },
  { splitLabel: "Split 5", categoryLabel: "MVP", recipientName: "Xabier Aznar" },
  { splitLabel: "Split 5", categoryLabel: "MVP Team", recipientName: "David Oliva" },
  { splitLabel: "Split 5", categoryLabel: "MVP Team", recipientName: "Oriol Romero" },
  { splitLabel: "Split 5", categoryLabel: "MVP Team", recipientName: "Cristina Tarrés" },
  { splitLabel: "Split 5", categoryLabel: "MVP Team", recipientName: "Xabier Aznar" },
  { splitLabel: "Split 5", categoryLabel: "MVP Team", recipientName: "Diego Pereira" },

  // Split 6
  { splitLabel: "Split 6", categoryLabel: "Cazador de soluciones", recipientName: "Xabier Aznar" },
  { splitLabel: "Split 6", categoryLabel: "Explorador de datos", recipientName: "David Masnou" },
  { splitLabel: "Split 6", categoryLabel: "Embajador de voz", recipientName: "Teresa Perez" },
  { splitLabel: "Split 6", categoryLabel: "Maestro Artesano", recipientName: "Janet Jakob" },
  { splitLabel: "Split 6", categoryLabel: "Domador de Escaladas", recipientName: "David Masnou" },
  { splitLabel: "Split 6", categoryLabel: "Cronomagia laboral", recipientName: "David Masnou" },
  { splitLabel: "Split 6", categoryLabel: "Guardián de la Estabilidad", recipientName: "Oriol Romero" },
  { splitLabel: "Split 6", categoryLabel: "Redactor estrella", recipientName: "Iban Saenz" },
  { splitLabel: "Split 6", categoryLabel: "Estudiante entusiasta", recipientName: "Luciano Moreira" },
  { splitLabel: "Split 6", categoryLabel: "Guardián del conocimiento", recipientName: "Oriol Romero" },
  { splitLabel: "Split 6", categoryLabel: "MVP", recipientName: "Teresa Perez" },
  { splitLabel: "Split 6", categoryLabel: "MVP Team", recipientName: "Dennis Barragán" },
  { splitLabel: "Split 6", categoryLabel: "MVP Team", recipientName: "Oriol Romero" },
  { splitLabel: "Split 6", categoryLabel: "MVP Team", recipientName: "Xabier Aznar" },
  { splitLabel: "Split 6", categoryLabel: "MVP Team", recipientName: "Diego Pereira" },
  { splitLabel: "Split 6", categoryLabel: "MVP Team", recipientName: "Arnau Titos" },

  // Split 7
  { splitLabel: "Split 7", categoryLabel: "Cazador de soluciones", recipientName: "Janet Jakob" },
  { splitLabel: "Split 7", categoryLabel: "Explorador de datos", recipientName: "Oriol Romero" },
  { splitLabel: "Split 7", categoryLabel: "Embajador de voz", recipientName: "Janet Jakob" },
  { splitLabel: "Split 7", categoryLabel: "Maestro Artesano", recipientName: "Arnau Titos" },
  { splitLabel: "Split 7", categoryLabel: "Domador de Escaladas", recipientName: "Oriol Romero" },
  { splitLabel: "Split 7", categoryLabel: "Cronomagia laboral", recipientName: "David Masnou" },
  { splitLabel: "Split 7", categoryLabel: "Guardián de la Estabilidad", recipientName: "David Masnou" },
  { splitLabel: "Split 7", categoryLabel: "Redactor estrella", recipientName: "Luciano Moreira" },
  { splitLabel: "Split 7", categoryLabel: "Estudiante entusiasta", recipientName: "Luciano Moreira" },
  { splitLabel: "Split 7", categoryLabel: "Aprendiz experto", recipientName: "Iban Saenz" },
  { splitLabel: "Split 7", categoryLabel: "MVP", recipientName: "David Masnou" },
  { splitLabel: "Split 7", categoryLabel: "MVP Team", recipientName: "Marisol Tascón" },
  { splitLabel: "Split 7", categoryLabel: "MVP Team", recipientName: "Xabier Aznar" },
  { splitLabel: "Split 7", categoryLabel: "MVP Team", recipientName: "Diego Pereira" },
  { splitLabel: "Split 7", categoryLabel: "MVP Team", recipientName: "Daria Prozorova" },
  { splitLabel: "Split 7", categoryLabel: "MVP Team", recipientName: "Arnau Titos" },

  // Split 8
  { splitLabel: "Split 8", categoryLabel: "Cazador de soluciones", recipientName: "Janet Jakob" },
  { splitLabel: "Split 8", categoryLabel: "Explorador de datos", recipientName: "Iban Saenz" },
  { splitLabel: "Split 8", categoryLabel: "Embajador de voz", recipientName: "Arnau Titos" },
  { splitLabel: "Split 8", categoryLabel: "Maestro Artesano", recipientName: "Janet Jakob" },
  { splitLabel: "Split 8", categoryLabel: "Domador de Escaladas", recipientName: "Oriol Romero" },
  { splitLabel: "Split 8", categoryLabel: "Cronomagia laboral", recipientName: "Teresa Perez" },
  { splitLabel: "Split 8", categoryLabel: "Guardián de la Estabilidad", recipientName: "Oriol Romero" },
  { splitLabel: "Split 8", categoryLabel: "Redactor estrella", recipientName: "Iban Saenz" },
  { splitLabel: "Split 8", categoryLabel: "Estudiante entusiasta", recipientName: "Cristina Tarrés" },
  { splitLabel: "Split 8", categoryLabel: "Aprendiz experto", recipientName: "Teresa Perez" },
  { splitLabel: "Split 8", categoryLabel: "MVP", recipientName: "Iban Saenz" },
  { splitLabel: "Split 8", categoryLabel: "MVP Team", recipientName: "David Oliva" },
  { splitLabel: "Split 8", categoryLabel: "MVP Team", recipientName: "Iban Saenz" },
  { splitLabel: "Split 8", categoryLabel: "MVP Team", recipientName: "Cristina Tarrés" },
  { splitLabel: "Split 8", categoryLabel: "MVP Team", recipientName: "Daria Prozorova" },
  { splitLabel: "Split 8", categoryLabel: "MVP Team", recipientName: "Arnau Titos" },

  // Split 9
  { splitLabel: "Split 9", categoryLabel: "Cazador de soluciones", recipientName: "Xabier Aznar" },
  { splitLabel: "Split 9", categoryLabel: "Explorador de datos", recipientName: "Xabier Aznar" },
  { splitLabel: "Split 9", categoryLabel: "Embajador de voz", recipientName: "Eduardo Felipe Menezes" },
  { splitLabel: "Split 9", categoryLabel: "Maestro Artesano", recipientName: "Xabier Aznar" },
  { splitLabel: "Split 9", categoryLabel: "Domador de Escaladas", recipientName: "David Masnou" },
  { splitLabel: "Split 9", categoryLabel: "Cronomagia laboral", recipientName: "Cristina Tarrés" },
  { splitLabel: "Split 9", categoryLabel: "Guardián de la Estabilidad", recipientName: "Oriol Romero" },
  { splitLabel: "Split 9", categoryLabel: "Redactor estrella", recipientName: "Daria Prozorova" },
  { splitLabel: "Split 9", categoryLabel: "Estudiante entusiasta", recipientName: "Cristina Tarrés" },
  { splitLabel: "Split 9", categoryLabel: "Aprendiz experto", recipientName: "Teresa Perez" },
  { splitLabel: "Split 9", categoryLabel: "MVP", recipientName: "Oriol Romero" },
];

/** Controles obligatorios de integridad (seccion 4.3 del encargo). */
export const LEGACY_BADGES_V1_EXPECTED_TOTALS = {
  splitCount: 9,
  recipientCount: 18,
  grantCount: 127,
  mvpCount: 9,
  teamMvpCount: 30,
  kpiCount: 88,
  byCategory: {
    "Cazador de soluciones": 9,
    "Explorador de datos": 9,
    "Embajador de voz": 9,
    "Maestro Artesano": 9,
    "Domador de Escaladas": 4,
    "Cronomagia laboral": 7,
    "Travesía del Padawan": 1,
    "Guardián de la Estabilidad": 7,
    "Redactor estrella": 12,
    "Estudiante entusiasta": 10,
    "Aprendiz experto": 8,
    "Guardián del conocimiento": 3,
    MVP: 9,
    "MVP Team": 30,
  } as Record<string, number>,
};
