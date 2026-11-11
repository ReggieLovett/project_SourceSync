import Dashboard from "./components/Dashboard";

/**
 * Server entry: tells the dashboard which vector database the server uses, so labels
 * match it. PINECONE_API_KEY is server-only, so the client can't read it itself.
 * The page is prerendered, so the label follows the environment at build time; on
 * Vercel, changing an environment variable needs a redeploy, which rebuilds.
 */
export default function Page() {
  return <Dashboard vectorDb={process.env.PINECONE_API_KEY?.trim() ? "Pinecone" : "ChromaDB"} />;
}
