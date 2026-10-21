import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { Moon, Sun } from "lucide-react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "careerbridge-theme";
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#f5f6ee" : "#161813");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* The switch still works when storage is unavailable. */
    }
  }, [theme]);
  useEffect(() => {
    const sync = (event) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        setTheme(event.newValue === "light" ? "light" : "dark");
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme: () =>
          setTheme((value) => (value === "dark" ? "light" : "dark")),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-label="Light theme"
      aria-checked={theme === "light"}
      title={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      onClick={toggleTheme}
    >
      <span className="theme-switch-track" aria-hidden="true">
        <Moon size={13} />
        <Sun size={13} />
        <span className="theme-switch-thumb" />
      </span>
      <span className="theme-switch-label" aria-hidden="true">
        {theme === "light" ? "Light" : "Dark"}
      </span>
    </button>
  );
}
