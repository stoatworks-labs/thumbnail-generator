import { ExportPanel } from './ExportPanel'
import { ImportPanel } from './ImportPanel'
import { Preview } from './Preview'
import { SourceTable } from './SourceTable'
import { StylePanel } from './StylePanel'

export function App() {
  return (
    <div className="app">
      <header className="app-head">
        <h1>Thumbnail Generator</h1>
        <p>
          Bulk-build labelled source thumbnails for Eventmaster and RCS2. Name each source, pick an
          icon, a size and a colour, then download the lot as a ZIP.
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
