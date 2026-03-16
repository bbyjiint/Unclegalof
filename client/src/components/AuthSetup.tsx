import { useEffect, useState } from "react";
import { api } from "../lib/api";

/**
 * Component to setup authentication token from test-setup endpoint
 * This is a temporary solution for testing - remove in production
 */
export default function AuthSetup() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if token already exists
    const existingToken = api.auth.getToken();
    if (existingToken) {
      setToken(existingToken);
    }
  }, []);

  async function setupAuth() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:4000/api/test-setup", {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error(`Failed to setup: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.token) {
        api.setAuthToken(data.token);
        setToken(data.token);
      } else {
        throw new Error("No token received");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to setup authentication");
    } finally {
      setLoading(false);
    }
  }

  if (token) {
    return (
      <div style={{ 
        padding: "8px 12px", 
        background: "var(--green-light)", 
        color: "var(--dark)",
        fontSize: "12px",
        borderRadius: "4px",
        marginBottom: "8px"
      }}>
        ✅ Authenticated (Test Mode)
      </div>
    );
  }

  return (
    <div style={{ 
      padding: "12px", 
      background: "var(--gold-light)", 
      border: "1px solid var(--gold)",
      borderRadius: "4px",
      marginBottom: "16px"
    }}>
      <p style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: 600 }}>
        🔐 Authentication Required
      </p>
      <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "var(--gray)" }}>
        Click the button below to setup test authentication. This will create a test business and user.
      </p>
      {error && (
        <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "var(--red)" }}>
          Error: {error}
        </p>
      )}
      <button 
        onClick={setupAuth} 
        disabled={loading}
        style={{
          padding: "6px 12px",
          background: "var(--green)",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "12px"
        }}
      >
        {loading ? "Setting up..." : "Setup Test Authentication"}
      </button>
    </div>
  );
}
