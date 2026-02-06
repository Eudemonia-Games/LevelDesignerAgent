import { APP_VERSION } from '@lda/shared';

function App() {
    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h1>LDA</h1>
            <p>Version: {APP_VERSION}</p>
            <div style={{ marginTop: '20px', padding: '10px', border: '1px dashed #ccc' }}>
                API health will be wired in LDA.0.2.0
            </div>
        </div>
    );
}

export default App;
