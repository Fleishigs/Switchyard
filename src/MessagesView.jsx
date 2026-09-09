import React, { useEffect, useRef, useState } from "react";
import {
  ChatCircleText,
  FolderOpen,
  Users,
  FileCode,
  MagnifyingGlass,
  ArrowLeft,
  Trash,
  X,
  Check,
  ArrowDown,
} from "@phosphor-icons/react";
import "./messages.css";
const date = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown date";
const time = (value) =>
  value
    ? new Date(value).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
export default function MessagesView({ api }) {
  const [threads, setThreads] = useState([]),
    [stats, setStats] = useState(null),
    [current, setCurrent] = useState(null),
    [messages, setMessages] = useState([]),
    [query, setQuery] = useState(""),
    [results, setResults] = useState(null),
    [within, setWithin] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(null),
    [confirm, setConfirm] = useState(false),
    [limit, setLimit] = useState(200);
  const request = useRef(0),
    scroller = useRef(null),
    confirmButton = useRef(null);
  useEffect(() => {
    let live = true;
    api
      .initialize()
      .then((data) => {
        if (live) {
          setThreads(data.threads || []);
          setStats(data.stats || null);
          setReady(true);
        }
      })
      .catch((e) => live && setError(e.message));
    const off = api.onProgress(setProgress);
    return () => {
      live = false;
      off();
    };
  }, [api]);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      if (!query.trim()) {
        setResults(null);
        return;
      }
      api
        .search(query)
        .then((data) => live && setResults(data.results))
        .catch((e) => live && setError(e.message));
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, threads, api]);
  useEffect(() => {
    if (confirm) confirmButton.current?.focus();
  }, [confirm]);
  async function action(fn) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  function checked(result) {
    if (result?.error) throw new Error(result.error);
    return result;
  }
  async function select(id, messageId) {
    const token = ++request.current;
    try {
      const data = checked(await api.thread(id));
      if (token !== request.current) return;
      setCurrent(data.thread);
      setMessages(data.messages);
      setWithin("");
      setLimit(messageId ? data.messages.length : 200);
      setTimeout(() => {
        if (messageId)
          document
            .getElementById("message-" + messageId)
            ?.scrollIntoView({ block: "center" });
        else if (scroller.current)
          scroller.current.scrollTop = scroller.current.scrollHeight;
      }, 50);
    } catch (e) {
      setError(e.message);
    }
  }
  const open = () =>
    action(async () => {
      await api.initialize();
      const data = checked(await api.open());
      if (data.canceled) return;
      setThreads(data.threads);
      setStats(data.stats);
      setCurrent(null);
      setMessages([]);
      setQuery("");
      setNotice(
        `Opened ${data.stats.messages.toLocaleString()} messages. Your original backup is unchanged.`,
      );
    });
  const contacts = () =>
    action(async () => {
      const data = checked(await api.importContacts());
      if (data.canceled) return;
      setThreads(data.threads);
      if (current) await select(current.id);
      setNotice(
        `Imported ${data.count} contacts. Conversation names are updated.`,
      );
    });
  const exportXml = (other) =>
    action(async () => {
      let source = { mode: "current" };
      if (other) {
        const picked = checked(await api.pickExport());
        if (picked.canceled) return;
        source = { mode: "file", srcPath: picked.path };
      }
      const data = checked(await api.exportXml(source));
      if (data.canceled) return;
      setNotice(
        `Exported ${data.count.toLocaleString()} messages and ${data.embedded} attachments to ${data.outPath}`,
      );
    });

  const filtered = messages.filter(
    (m) => !within || m.body.toLowerCase().includes(within.toLowerCase()),
  );
  return (
    <section className="messages-workspace" aria-label="Messages workspace">
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR CONVERSATIONS, KEPT CLOSE</p>
          <h1>Messages</h1>
          <p>
            Browse Fig backups, restore contact names, and convert messages to
            standard XML.
          </p>
        </div>
        <span className="count-pill">Local & private</span>
      </div>
      <div className="messages-toolbar" aria-label="Message tools">
        <button className="primary" onClick={open} disabled={busy || !ready}>
          <FolderOpen size={19} />
          Open Fig backup
        </button>
        <button
          className="secondary"
          onClick={contacts}
          disabled={busy || !ready}
        >
          <Users size={19} />
          Import contacts
        </button>
        <button
          className="secondary"
          onClick={() => exportXml(false)}
          disabled={busy || !stats}
        >
          <FileCode size={19} />
          Export XML
        </button>
        <button
          className="messages-text-button"
          onClick={() => exportXml(true)}
          disabled={busy || !ready}
        >
          Convert another backup
        </button>
      </div>
      {error && (
        <div className="messages-notice error" role="alert">
          {error}
          <button
            aria-label="Dismiss message error"
            onClick={() => setError("")}
          >
            <X />
          </button>
        </div>
      )}
      {notice && (
        <div className="messages-notice" role="status">
          <Check size={18} />
          <span>{notice}</span>
        </div>
      )}
      {busy && (
        <div className="messages-notice" role="status">
          {progress
            ? `Exporting ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()} messages…`
            : "Working on your backup…"}
        </div>
      )}
      {!stats ? (
        <div className="messages-welcome">
          <div className="messages-art">
            <ChatCircleText size={68} weight="duotone" />
            <span>
              <Users size={26} />
            </span>
          </div>
          <p className="eyebrow">A PLACE FOR EVERY CONVERSATION</p>
          <h2>
            Old messages.
            <br />
            Familiar faces.
          </h2>
          <p>
            Open your Fig ZIP backup to bring texts, photos, voice messages, and
            group chats together. Import a contact file to put names to numbers.
          </p>
          <button className="primary" onClick={open} disabled={busy || !ready}>
            Choose a backup <ArrowDown size={18} />
          </button>
          <small>
            Fig ZIP or NDJSON · vCard contacts · SMS Backup & Restore XML
          </small>
        </div>
      ) : (
        <div className={"messages-desk " + (current ? "has-conversation" : "")}>
          <aside className="messages-list" aria-label="Conversations">
            <div className="messages-list-head">
              <div>
                <strong>{threads.length} conversations</strong>
                <small>{stats.messages.toLocaleString()} messages</small>
              </div>
              <button
                aria-label="Clear imported messages"
                disabled={busy || !ready}
                onClick={() => setConfirm(true)}
              >
                <Trash size={18} />
              </button>
            </div>
            <label className="messages-search">
              <MagnifyingGlass size={18} />
              <input
                aria-label="Search all messages"
                placeholder="Search conversations"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  aria-label="Clear message search"
                  onClick={() => setQuery("")}
                >
                  <X size={16} />
                </button>
              )}
            </label>
            <div className="messages-thread-list">
              {results !== null ? (
                <>
                  <p className="messages-search-count">
                    {results.length} matches
                    {results.length === 400 ? " (first 400)" : ""}
                  </p>
                  {results.map((r, i) => (
                    <button
                      className="messages-thread"
                      key={i}
                      onClick={() => select(r.threadId, r.messageId)}
                    >
                      <div>
                        <strong dir="auto">{r.threadTitle}</strong>
                        <p dir="auto">{r.snippet}</p>
                        <small>{date(r.ts)}</small>
                      </div>
                    </button>
                  ))}
                  {!results.length && (
                    <p className="messages-quiet">
                      No messages match this search.
                    </p>
                  )}
                </>
              ) : (
                threads.map((t) => (
                  <button
                    className={
                      "messages-thread " +
                      (current?.id === t.id ? "selected" : "")
                    }
                    key={t.id}
                    onClick={() => select(t.id)}
                  >
                    <span className="messages-avatar">
                      {t.isGroup ? (
                        <Users size={22} />
                      ) : (
                        t.title.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <div>
                      <strong dir="auto">{t.title}</strong>
                      <p dir="auto">{t.lastSnippet}</p>
                      <small>
                        {date(t.lastDate)} · {t.messageCount} messages
                      </small>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>
          <div className="messages-conversation">
            {!current ? (
              <div className="messages-select">
                <ChatCircleText size={48} weight="duotone" />
                <h2>Pick up where you left off</h2>
                <p>Choose a conversation to explore its messages.</p>
              </div>
            ) : (
              <>
                <header className="messages-conversation-head">
                  <button
                    aria-label="Back to conversations"
                    onClick={() => setCurrent(null)}
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <h2 dir="auto">{current.title}</h2>
                    <small>
                      {current.participants.map((p) => p.number).join(" · ")}
                    </small>
                  </div>
                  <label className="messages-search">
                    <MagnifyingGlass size={17} />
                    <input
                      aria-label="Search this conversation"
                      placeholder="Find in chat"
                      value={within}
                      onChange={(e) => setWithin(e.target.value)}
                    />
                  </label>
                </header>
                <div className="messages-bubbles" ref={scroller}>
                  {filtered.length > limit && (
                    <button
                      className="secondary messages-older"
                      onClick={() => setLimit((n) => n + 200)}
                    >
                      Show earlier messages ({filtered.length - limit})
                    </button>
                  )}
                  {filtered.slice(-limit).map((m, i, array) => (
                    <React.Fragment key={m.id + "-" + i}>
                      {(i === 0 || date(array[i - 1].ts) !== date(m.ts)) && (
                        <div className="messages-day">{date(m.ts)}</div>
                      )}
                      <article
                        id={"message-" + m.id}
                        className={"message-bubble " + m.dir}
                      >
                        <strong>
                          {m.dir === "out"
                            ? "You"
                            : m.sender?.name ||
                              m.sender?.number ||
                              current.title}
                        </strong>
                        {m.body && <p dir="auto">{m.body}</p>}
                        {m.attachments.map((a, index) => (
                          <Attachment key={index} item={a} />
                        ))}
                        <time>{time(m.ts)}</time>
                      </article>
                    </React.Fragment>
                  ))}
                  {!filtered.length && (
                    <p className="messages-quiet">
                      No messages match this search.
                    </p>
                  )}
                </div>
                <footer className="messages-readonly">
                  Saved conversations · Read-only backup
                </footer>
              </>
            )}
          </div>
        </div>
      )}
      {confirm && (
        <div className="messages-confirm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-messages-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setConfirm(false);
              if (e.key === "Tab") {
                const buttons = [...e.currentTarget.querySelectorAll("button")];
                e.preventDefault();
                buttons[
                  (buttons.indexOf(document.activeElement) +
                    (e.shiftKey ? -1 : 1) +
                    buttons.length) %
                    buttons.length
                ].focus();
              }
            }}
          >
            <h2 id="clear-messages-title">Clear imported data?</h2>
            <p>
              This removes Switchyard’s saved message copy and imported contact
              names. Your original backup files stay untouched.
            </p>
            <div>
              <button
                ref={confirmButton}
                className="secondary"
                onClick={() => setConfirm(false)}
              >
                Keep messages
              </button>
              <button
                className="primary"
                onClick={() =>
                  action(async () => {
                    checked(await api.clear());
                    setThreads([]);
                    setStats(null);
                    setCurrent(null);
                    setMessages([]);
                    setQuery("");
                    setConfirm(false);
                    setNotice("Imported data cleared.");
                  })
                }
              >
                Clear imported data
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
function Attachment({ item: a }) {
  const source = a.file ? "att://file/" + encodeURIComponent(a.file) : null;
  if (a.kind === "image" && source)
    return (
      <img src={source} alt={a.name || "Message attachment"} loading="lazy" />
    );
  if (a.kind === "audio" && source)
    return (
      <audio
        controls
        preload="none"
        src={source}
        aria-label={a.name || "Voice message"}
      />
    );
  if (a.kind === "video" && source)
    return (
      <video
        controls
        preload="metadata"
        src={source}
        aria-label={a.name || "Video message"}
      />
    );
  return (
    <div className="message-attachment">
      <Users size={18} />
      <span>
        {a.name || "Attachment"}
        {a.text && <pre>{a.text}</pre>}
      </span>
    </div>
  );
}
