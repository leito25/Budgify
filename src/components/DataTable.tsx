import { useMemo, useState, type ReactNode } from "react";

export interface DataColumn<Row> {
  key: string;
  label: string;
  value: (row: Row) => string | number;
  render?: (row: Row) => ReactNode;
}

interface DataTableProps<Row> {
  rows: Row[];
  columns: DataColumn<Row>[];
  rowKey: (row: Row) => string;
  searchLabel: string;
  actionsLabel: string;
  recordsLabel: string;
  searchText: (row: Row) => string;
  emptyText: string;
  actions?: (row: Row) => ReactNode;
}

export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  searchLabel,
  actionsLabel,
  recordsLabel,
  searchText,
  emptyText,
  actions,
}: DataTableProps<Row>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(columns[0]?.key ?? "");
  const [ascending, setAscending] = useState(true);

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) =>
      searchText(row).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    const column = columns.find((item) => item.key === sortKey);
    if (!column) return filtered;
    return [...filtered].sort((a, b) => {
      const left = column.value(a);
      const right = column.value(b);
      const order = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
      return ascending ? order : -order;
    });
  }, [ascending, columns, query, rows, searchText, sortKey]);

  function toggleSort(key: string) {
    if (sortKey === key) setAscending((value) => !value);
    else {
      setSortKey(key);
      setAscending(true);
    }
  }

  return (
    <div className="table-section">
      <label className="search-field">
        <span>{searchLabel}</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sortKey === column.key ? ascending ? "ascending" : "descending" : "none"}
                >
                  <button type="button" className="sort-button" onClick={() => toggleSort(column.key)}>
                    {column.label}
                    <span aria-hidden="true">{sortKey === column.key ? ascending ? " ↑" : " ↓" : ""}</span>
                  </button>
                </th>
              ))}
              {actions && <th scope="col"><span className="sr-only">{actionsLabel}</span></th>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr><td colSpan={columns.length + Number(Boolean(actions))} className="empty-cell">{emptyText}</td></tr>
            )}
            {visibleRows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render ? column.render(row) : column.value(row)}</td>
                ))}
                {actions && <td className="row-actions">{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-count" aria-live="polite">{visibleRows.length} {recordsLabel}</p>
    </div>
  );
}
