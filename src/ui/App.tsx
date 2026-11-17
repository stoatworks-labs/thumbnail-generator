import { ExportPanel } from './ExportPanel'
import { ImportPanel } from './ImportPanel'
import { Preview } from './Preview'
import { SourceTable } from './SourceTable'
import { StylePanel } from './StylePanel'

export function App() {
  return (
    <div className="app">
      <header className="app-head">
        <div className="sw-bar app-bar">
          <h1 className="sw-brand">
            <span className="sw-mark" aria-hidden="true">▧</span> Thumbnail Generator
          </h1>
          <button type="button" className="about" data-stoatworks-about>
            About
          </button>
        </div>
        <p>
          Bulk-build labelled source thumbnails for Eventmaster and RCS2. Name each source, pick an
          icon, a size and a colour, then download the lot as a ZIP.{' '}
          <a href="https://stoatworks-labs.com/web-tools/thumbnail-generator/" target="_blank" rel="noopener">
            About this tool
          </a>
        </p>
      </header>

      <main>
        <div className="col-main">
          <SourceTable />
          <ImportPanel />
        </div>
        <div className="col-side">
          <section className="panel preview-panel">
            <header className="panel-head">
              <h2>Preview</h2>
            </header>
            <Preview />
          </section>
          <StylePanel />
          <ExportPanel />
        </div>
      </main>
    </div>
  )
}
