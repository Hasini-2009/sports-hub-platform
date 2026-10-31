import os
import glob
import logging
from typing import List, Dict, Any, Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

COLLECTION_NAME = "sports_injury_knowledge_v1"


class SimpleDeterministicEmbedding:
    """Fallback embedding generator if online embedding download is unavailable."""
    def __init__(self, dim: int = 64):
        self.dim = dim

    def __call__(self, input: List[str]) -> List[List[float]]:
        embeddings = []
        for text in input:
            vec = [0.0] * self.dim
            words = text.lower().split()
            for i, w in enumerate(words):
                h = hash(w) % self.dim
                vec[h] += 1.0 / (1.0 + (i * 0.05))
            # Normalize vector
            norm = sum(x * x for x in vec) ** 0.5 or 1.0
            embeddings.append([x / norm for x in vec])
        return embeddings

    def embed_query(self, input: Any) -> List[List[float]]:
        if isinstance(input, str):
            return self([input])
        return self(list(input))

    def embed_documents(self, input: List[str]) -> List[List[float]]:
        return self(input)

    def name(self) -> str:
        return "simple_deterministic_embedding"


class InjuryRAGService:
    def __init__(self):
        self.client = None
        self.collection = None
        self._initialized = False

    def initialize(self):
        if self._initialized:
            return

        try:
            import chromadb
            os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
            self.client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)

            # Use lightweight deterministic local embedding function so startup never hangs or relies on network
            self.embedding_fn = SimpleDeterministicEmbedding()
            self.collection = self.client.get_or_create_collection(
                name=COLLECTION_NAME,
                embedding_function=self.embedding_fn,
                metadata={"hnsw:space": "cosine"}
            )

            self._index_corpus_if_empty()
            self._initialized = True
            logger.info("ChromaDB Injury RAG initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB RAG: {e}")

    def _index_corpus_if_empty(self):
        if not self.collection:
            return

        current_count = self.collection.count()
        if current_count > 0:
            logger.info(f"ChromaDB collection already contains {current_count} documents. Skipping re-indexing.")
            return

        corpus_dir = os.path.join(os.path.dirname(__file__), "corpus")
        md_files = glob.glob(os.path.join(corpus_dir, "*.md"))
        logger.info(f"Indexing {len(md_files)} markdown files from corpus...")

        chunk_size = 500
        overlap = 50

        docs_to_add = []
        ids_to_add = []
        metadatas_to_add = []

        for fpath in md_files:
            filename = os.path.basename(fpath)
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    content = f.read()

                # Chunking
                start = 0
                idx = 0
                while start < len(content):
                    end = min(start + chunk_size, len(content))
                    chunk = content[start:end].strip()
                    if chunk:
                        chunk_id = f"{filename}_{idx}"
                        docs_to_add.append(chunk)
                        ids_to_add.append(chunk_id)
                        metadatas_to_add.append({"source": filename, "chunk_index": idx})
                        idx += 1
                    start += (chunk_size - overlap)
            except Exception as e:
                logger.warning(f"Error reading {filename}: {e}")

        if docs_to_add:
            self.collection.add(
                documents=docs_to_add,
                ids=ids_to_add,
                metadatas=metadatas_to_add
            )
            logger.info(f"Successfully indexed {len(docs_to_add)} chunks into ChromaDB.")

    def query_corpus(self, question: str, top_k: int = 4) -> List[Dict[str, Any]]:
        self.initialize()
        if not self.collection:
            return []

        try:
            results = self.collection.query(
                query_texts=[question],
                n_results=top_k
            )
            chunks = []
            if results and "documents" in results and results["documents"]:
                docs = results["documents"][0]
                metas = results["metadatas"][0] if "metadatas" in results and results["metadatas"] else [{}] * len(docs)
                ids = results["ids"][0] if "ids" in results and results["ids"] else [f"doc_{i}" for i in range(len(docs))]

                for doc, meta, cid in zip(docs, metas, ids):
                    chunks.append({
                        "text": doc,
                        "source": meta.get("source", "knowledge_base"),
                        "id": cid
                    })
            return chunks
        except Exception as e:
            logger.warning(f"ChromaDB query failed: {e}")
            return []

    def check_health(self) -> Dict[str, Any]:
        chromadb_reachable = False
        try:
            self.initialize()
            if self.collection is not None:
                _ = self.collection.count()
                chromadb_reachable = True
        except Exception:
            chromadb_reachable = False

        ollama_reachable = False
        try:
            with httpx.Client(timeout=2.0) as client:
                res = client.get(f"{settings.OLLAMA_URL}/api/tags")
                ollama_reachable = (res.status_code == 200)
        except Exception:
            ollama_reachable = False

        return {
            "status": "ok",
            "ollama_reachable": ollama_reachable,
            "chromadb_reachable": chromadb_reachable,
            "model": settings.OLLAMA_MODEL
        }


rag_service = InjuryRAGService()
