import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { TranslationKey } from "../i18n";
import type { SearchResult } from "./local-search";

interface SearchBoxProps {
  search: (text: string) => Promise<SearchResult[]>;
  onSelect: (result: SearchResult) => void;
  t: (key: TranslationKey) => string;
}

type Outcome =
  | { status: "idle" }
  | { status: "failed" }
  | { status: "done"; results: SearchResult[] };

export function SearchBox({ search, onSelect, t }: SearchBoxProps) {
  const listId = useId();
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<Outcome>({ status: "idle" });
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const latest = useRef(0);

  function change(next: string) {
    setText(next);
    setOpen(true);
    setActive(-1);
    const request = (latest.current += 1);
    if (!next.trim()) return setOutcome({ status: "idle" });
    search(next).then(
      // Only the newest search may show its answer.
      (results) =>
        request === latest.current && setOutcome({ status: "done", results }),
      () => request === latest.current && setOutcome({ status: "failed" }),
    );
  }

  function choose(result: SearchResult) {
    latest.current += 1;
    setOpen(false);
    setText("");
    setOutcome({ status: "idle" });
    onSelect(result);
  }

  const results = outcome.status === "done" ? outcome.results : [];

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setActive((index) => (index <= 0 ? results.length : index) - 1);
    } else if (event.key === "Enter" && open && results[active]) {
      event.preventDefault();
      choose(results[active]);
    }
  }

  const showPanel = open && outcome.status !== "idle";
  const showList = showPanel && results.length > 0;
  return (
    <div className="search-box" role="search">
      <input
        type="search"
        role="combobox"
        aria-label={t("search.label")}
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        placeholder={t("search.placeholder")}
        value={text}
        onChange={(event) => change(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      />
      {showPanel && (
        <div className="search-panel">
          {showList && (
            <ul id={listId} role="listbox" aria-label={t("search.results")}>
              {results.map((result, index) => (
                // Keyboard use goes through the input (aria-activedescendant).
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                <li
                  key={`${result.kind}-${result.id}`}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={index === active ? "active" : undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(result)}
                >
                  <span className="search-kind">
                    {t(
                      result.kind === "loan" ? "search.loan" : "search.income",
                    )}
                  </span>
                  {result.name}
                </li>
              ))}
            </ul>
          )}
          {outcome.status === "done" && results.length === 0 && (
            <p role="status" className="search-message">
              {t("search.noResults")}
            </p>
          )}
          {outcome.status === "failed" && (
            <p role="alert" className="search-message">
              {t("search.failed")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
