import type { Audit, PersonRef } from "../domain/types";
import type { TranslationKey } from "../i18n";

/** A person is shown by name, or by email when they have no name. */
export function personLabel(person: PersonRef): string {
  return person.name?.trim() || person.email;
}

/** Whoever changed a record last, when that is not who added it. */
export function lastChangedBy(record: Audit): PersonRef | null {
  const { addedBy, changedBy } = record;
  return addedBy && changedBy && changedBy.id !== addedBy.id ? changedBy : null;
}

export function AuditNote({
  record,
  t,
}: {
  record: Audit | undefined;
  t: (key: TranslationKey) => string;
}) {
  if (!record?.addedBy) return null;
  const changed = lastChangedBy(record);
  return (
    <span className="audit-note">
      <span>
        {t("audit.addedBy")} {personLabel(record.addedBy)}
      </span>
      {changed && (
        <span className="small muted">
          {t("audit.changedBy")} {personLabel(changed)}
        </span>
      )}
    </span>
  );
}
