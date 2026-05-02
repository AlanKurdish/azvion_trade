import { Controller, Get, Header } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class LegalController {
  constructor(private prisma: PrismaService) {}

  /**
   * Public, browser-renderable HTML privacy policy.
   * This is the URL submitted to the Google Play Console.
   */
  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  async privacy(): Promise<string> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: 'privacy_policy' },
    });
    const text =
      setting?.value?.trim() ||
      'No privacy policy has been published yet. Please contact the app owner.';

    return this.renderPage('Azne App — Privacy Policy', text);
  }

  private renderPage(title: string, text: string): string {
    // Convert plain text to safe HTML: escape, then turn double-newlines
    // into paragraphs and single newlines into <br>.
    const esc = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const paragraphs = text
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
  :root {
    --bg: #0f172a;
    --surface: #1e293b;
    --border: #334155;
    --gold: #D4AF37;
    --text: #e2e8f0;
    --muted: #94a3b8;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: 1.7;
    -webkit-font-smoothing: antialiased;
  }
  .wrap {
    max-width: 760px;
    margin: 0 auto;
    padding: 48px 24px 96px;
  }
  header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 20px;
    margin-bottom: 32px;
  }
  h1 {
    color: var(--gold);
    font-size: 28px;
    margin: 0 0 6px 0;
    letter-spacing: 0.5px;
  }
  .subtitle {
    color: var(--muted);
    font-size: 14px;
  }
  article {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 28px 32px;
  }
  p {
    margin: 0 0 14px 0;
    font-size: 15px;
    color: var(--text);
  }
  p:last-child { margin-bottom: 0; }
  footer {
    margin-top: 36px;
    text-align: center;
    color: var(--muted);
    font-size: 12px;
  }
  footer a { color: var(--gold); text-decoration: none; }
  footer a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>${esc(title)}</h1>
      <div class="subtitle">eaaktech</div>
    </header>
    <article>
${paragraphs}
    </article>
    <footer>
      &copy; ${new Date().getFullYear()} eaaktech &middot;
      <a href="mailto:alan-dev@hotmail.com">alan-dev@hotmail.com</a>
    </footer>
  </div>
</body>
</html>`;
  }
}
