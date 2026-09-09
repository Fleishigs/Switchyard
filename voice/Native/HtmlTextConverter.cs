using System.Net;
using System.Text.RegularExpressions;

namespace SwitchyardVoice.Native;

/// <summary>
/// Converts HTML returned by the transcription/formatting service into clean,
/// readable plain text. Lists become "- item" lines, block elements become line
/// breaks, inline tags are stripped, and HTML entities are decoded.
///
/// If the input does not actually look like HTML it is returned unchanged, so
/// ordinary dictated text (which may legitimately contain "&lt;" or "a &gt; b")
/// is never mangled.
/// </summary>
public static class HtmlTextConverter
{
    // The tag name must immediately follow "<" (or "</") and any attributes
    // cannot contain angle brackets. This avoids treating prose like
    // "a < b and b > c" as a <b> tag.
    private static readonly Regex HtmlTagLike = new(
        @"</?(?:ul|ol|li|p|br|div|span|strong|em|b|i|u|a|h[1-6]|table|thead|tbody|tr|td|th|blockquote|code|pre|hr)(?:\s[^<>]*)?/?>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex BrTag = new(
        @"<\s*br\s*/?\s*>", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex ListItemOpen = new(
        @"<\s*li[^>]*>", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex BlockClose = new(
        @"<\s*/\s*(p|div|ul|ol|li|h[1-6]|tr|table|blockquote|pre)\s*>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex AnyTag = new(@"<[^>]+>", RegexOptions.Compiled);

    // Deliberately wider than [ \t]. HTML decoding turns &nbsp; into U+00A0, which looks
    // exactly like a space but is not one: left in the pasted text it breaks Find, breaks
    // code, and makes a dictated shell command fail with a baffling error. The other
    // ranges cover the en/em/thin/figure spaces and the zero-width no-break space that
    // formatted service output can contain.
    private static readonly Regex InlineSpaces = new(
        @"[ \t\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF]+",
        RegexOptions.Compiled);

    public static bool LooksLikeHtml(string? text)
        => !string.IsNullOrEmpty(text) && HtmlTagLike.IsMatch(text);

    public static string ToPlainText(string? text)
    {
        if (string.IsNullOrEmpty(text)) return text ?? string.Empty;
        if (!LooksLikeHtml(text)) return text;

        var s = text;
        s = BrTag.Replace(s, "\n");
        s = ListItemOpen.Replace(s, "\n- ");   // each list item on its own bullet line
        s = BlockClose.Replace(s, "\n");        // block elements end a line
        s = AnyTag.Replace(s, "");              // drop any remaining tags
        s = WebUtility.HtmlDecode(s);           // &amp; -> &, &nbsp; -> space, etc.

        // Tidy whitespace line-by-line and drop empty / bullet-only lines.
        var lines = s.Replace("\r\n", "\n").Replace("\r", "\n").Split('\n');
        var cleaned = new List<string>(lines.Length);
        foreach (var line in lines)
        {
            var trimmed = InlineSpaces.Replace(line, " ").Trim();
            if (trimmed.Length == 0 || trimmed == "-") continue;
            cleaned.Add(trimmed);
        }

        return string.Join("\n", cleaned);
    }
}
