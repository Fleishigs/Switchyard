# Switchyard 1.1.0: the new workspaces

## Edit one file

Open an operation, then use **Choose file** or **Choose another**. **Edit file** identifies the file that will actually be processed. Files with the same name include their folder; generated files identify the originating result. The file library is available across tools, but ordinary editing uses one selected input unless you enable **Batch processing**.

## Trim audio or video

Choose **Trim audio** or **Trim video**. The initial selection covers the whole file. Type seconds or a timecode into **In point** and **Out point**, then press Enter or leave the field to commit. Drag the timeline handles for direct selection. **Play selection** auditions the chosen interval; **Create result** exports it. Zoom and pan change the view without changing the selected interval. Use **Undo adjustment** and **Redo adjustment** to recover edits.

Video stepping follows the reported average frame rate. Variable-frame-rate timestamp stepping and multiple separate cut segments are not implemented. GIF selections are limited to 30 seconds and the editor shows that actual limit.

## AI image enhancement

Open **Images → AI image enhancement**. Choose **Upscayl Lite**, **Upscayl Standard** or **Digital Art**, then 2×/4× and an output format. Processing is local and needs a supported Vulkan GPU. The original is retained. Inspect the result, open **Compare before & after**, or use **Inspect detail** to review a larger preview. The detail preview is capped at 4096 pixels; the saved output keeps its full dimensions.

**Adjust photo contrast** is the separate, fast non-AI operation. AI enhancement can invent plausible detail; a larger image is not proof that lost detail was recovered accurately.

## Remove vocals

Open **Voice & AI → Separate vocals**. Choose your recording and create the result. The output selector contains the instrumental and vocal files; each can be played and saved individually.

## Save or continue editing

**Source** retains your editing controls; **Result** contains the last output. Changing controls does not alter an existing saved result: choose **Create result** again. **Save as…** writes a copy to your chosen destination. **Use result as input** continues from the selected output. For text operations, it places the generated text back in the input editor.

## Combine files and convert batches

PDF merging and image contact sheets show inputs in output order. The Earlier/Later buttons visibly reorder that list. Ordinary batch processing runs only checked files with shared settings. The dedicated **Batch converter** lets you assign a different target format to each file and records per-file results.

## Message backups

Open **Messages**, then **Open Fig backup**. Import contacts with the VCF option when needed. **Export XML** writes the messages backup format; it is separate from importing contact names.

See [the tool review](TOOL-WORKFLOW-AUDIT.md) for remaining feature gaps and [release notes](RELEASE-1.1.0.md) for validation scope.
