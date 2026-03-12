import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useParams, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CookieBanner } from "./components/CookieBanner";
import { SiteFooter } from "./components/SiteFooter";
import Home from "./pages/Home";
import BookDetail from "./pages/BookDetail";
import Reader from "./pages/Reader";
import Impressum from "./pages/Impressum";
import Datenschutz from "./pages/Datenschutz";

function BookDetailRoute() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  if (!id) return <NotFound />;
  return <BookDetail bookId={id} />;
}

function ReaderRoute() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  if (!id) return <NotFound />;
  return <Reader bookId={id} />;
}

/** Hide the footer inside the full-screen reader */
function FooterWrapper() {
  const [location] = useLocation();
  if (location.startsWith("/read/")) return null;
  return <SiteFooter />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/book/:id" component={BookDetailRoute} />
      <Route path="/read/:id" component={ReaderRoute} />
      <Route path="/impressum" component={Impressum} />
      <Route path="/datenschutz" component={Datenschutz} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <div className="flex flex-col min-h-screen">
            <div className="flex-1">
              <Router />
            </div>
            <FooterWrapper />
          </div>
          <CookieBanner />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
