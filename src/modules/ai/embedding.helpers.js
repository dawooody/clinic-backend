const EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL || 'Xenova/bge-base-en-v1.5';
const EMBEDDING_SIZE = 768;

let extractor;
let extractorPromise;

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getExtractor = async () => {
  if (extractor) {
    return extractor;
  }

  if (!extractorPromise) {
    extractorPromise = import('@xenova/transformers')
      .then(({ pipeline }) => pipeline('feature-extraction', EMBEDDING_MODEL))
      .then((loadedExtractor) => {
        extractor = loadedExtractor;
        return extractor;
      })
      .catch((error) => {
        extractorPromise = null;
        throw error;
      });
  }

  return extractorPromise;
};

const generateEmbedding = async (text) => {
  const trimmedText = text?.trim();

  if (!trimmedText) {
    throw createHttpError(400, 'Query text is required.');
  }

  try {
    // The embedding model is English-focused. Arabic input should be translated
    // before this step once a translation provider is introduced.
    const embeddingExtractor = await getExtractor();
    const output = await embeddingExtractor(trimmedText, {
      pooling: 'mean',
      normalize: true,
    });

    const embedding = Array.from(output.data);

    if (embedding.length !== EMBEDDING_SIZE) {
      throw new Error(`Expected embedding size ${EMBEDDING_SIZE}, received ${embedding.length}.`);
    }

    return embedding;
  } catch (error) {
    if (error.status) {
      throw error;
    }

    throw createHttpError(500, `Failed to generate embedding: ${error.message}`);
  }
};

module.exports = {
  EMBEDDING_MODEL,
  EMBEDDING_SIZE,
  generateEmbedding,
};
