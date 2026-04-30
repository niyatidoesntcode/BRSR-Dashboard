// components/principleHandlers/P3Handler.js
import React, { useEffect } from "react";

export function QuestionPage({ onGoToQuestion }) {
  useEffect(() => {
    onGoToQuestion?.("P3_Quant");
  }, [onGoToQuestion]);

  return null;
}
