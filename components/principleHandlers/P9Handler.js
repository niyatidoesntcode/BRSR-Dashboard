import React, { useEffect } from "react";

export function QuestionPage({ onGoToQuestion }) {
	useEffect(() => {
		onGoToQuestion?.("P9_Quant");
	}, [onGoToQuestion]);

	return null;
}
