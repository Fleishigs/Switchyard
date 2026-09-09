# Make something with Switchyard

## Your Fig backups

Open **Messages** in the sidebar, then **Open Fig backup** and choose a Fig ZIP or message NDJSON file. Your conversations appear inside Switchyard. Select a conversation to read it; use **Search conversations** for all messages or **Find in chat** for one conversation.

The actions have different jobs:

| Action | What it does |
| --- | --- |
| Open Fig backup | Imports a backup for browsing. |
| Import contacts | Reads a VCF file to replace phone numbers with contact names. |
| Export XML | Saves the currently imported messages as SMS Backup & Restore XML, including supported attachments. |
| Convert another backup | Selects a different source and exports its XML without replacing the conversations you have open. |

XML is a message-backup format; this is not an Excel export. Import contacts before exporting if you want those names in the XML. Your original backup stays intact, including when you clear the imported copy using the trash button.

## Turn a pile of files into a finished batch

Drag files into the app, then choose **Batch converter**. Choose a destination beside each file, or apply one format to all compatible files. Unsupported files are identified so the rest of the batch can continue.

Open **Queue & history** to check results. You can save the first output elsewhere, reveal a result in Explorer, or use the results in another tool. Each job keeps separate outputs, so you can compare versions without overwriting the originals.

## Find the right tool quickly

- Press **Ctrl+K** to search the catalogue.
- Star tools you use often; **Favorites** survives a restart.
- **Ask Switchyard** matches a written task to existing tools. Try “crop image”, “merge PDF”, or “remove audio”.
- Press **Escape** to close a tool's settings.
- Use the sun/moon button to switch themes.

## Work with sound and speech

Use **Remove audio** for a silent video. Use **Vocal separation** for separate vocal and instrumental audio; this takes more CPU time.

**Record a thought** records inside Switchyard. **Open Voice companion** opens the local dictation utility. Configure its dictation mode before using automatic pasting. Its global shortcut is **Ctrl+Shift+Space**. Exact Windows commands are a separate mode; ordinary dictated text is not interpreted as arbitrary commands.

The included engines and English models run locally. YouTube downloads need internet access. If an engine is unavailable, open **Engines**, choose the correct executable or model, and select **Refresh status**.

See [the verification report](VERIFICATION.md) for tested flows and format/device limits.
