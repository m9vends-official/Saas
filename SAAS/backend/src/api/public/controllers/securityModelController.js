import { analyzeSecurityFrame } from "../../../services/securityModelService.js";

export const analyzeSecurityFrameHandler = async (req, res, next) => {
  try {
    const result = await analyzeSecurityFrame({
      body: req.body,
      contentType: req.headers["content-type"],
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

