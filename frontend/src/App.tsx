import { BrowserRouter } from 'react-router-dom';
import AppRouter from './AppRouter';
import { StoreProvider } from './contextApi/ContextApi';

function App() {
  return (
    <StoreProvider>
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-indigo-500/30">
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </div>
    </StoreProvider>
  );
}

export default App;
