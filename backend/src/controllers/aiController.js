const { analyzeImage, aiHealth } = require('../services/aiPipeline');
const { HttpError } = require('../utils/http');

// ─── Analyze a photo before the report is submitted ──────────────────────────
// Used by the report wizard to pre-fill the category. The uploaded file is not
// stored; only the analysis is returned (without the embedding).
const analyzePreview = async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'Attach an image');
    const result = await analyzeImage(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({
      success: true,
      data: {
        suggestedCategory: result.suggested_category,
        categoryGuesses: result.category_guesses,
        detectedObjects: result.detected_objects,
        primaryLabel: result.primary_label,
        annotatedImage: result.annotated_image,
      },
    });
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
      return res.status(503).json({ success: false, message: 'The AI service is offline. You can still submit the report.' });
    }
    if (err.response?.data?.detail) return next(new HttpError(err.response.status, err.response.data.detail));
    next(err);
  }
};

const status = async (req, res) => {
  const health = await aiHealth();
  res.json({ success: true, online: Boolean(health && health.status === 'ok'), health });
};

module.exports = { analyzePreview, status };
