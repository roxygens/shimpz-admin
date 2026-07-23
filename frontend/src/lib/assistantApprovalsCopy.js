export const ASSISTANT_APPROVALS_COPY = Object.freeze({
  en: {
    kicker: 'Power // Approval',
    title: 'Review before running',
    lead: 'Your Team paused before an external action. Review the request below.',
    always: 'Approval is required every time this Power runs.',
    once: 'Approval is remembered only for this exact Assistant release until you revoke it.',
    cancel: 'Cancel',
    approve: 'Approve and continue',
  },
  pt: {
    kicker: 'Power // Aprovação',
    title: 'Revise antes de executar',
    lead: 'Seu Time pausou antes de uma ação externa. Revise a solicitação abaixo.',
    always: 'A aprovação é solicitada sempre que este Power for executado.',
    once: 'A aprovação vale apenas para esta versão exata do Assistant até você revogá-la.',
    cancel: 'Cancelar',
    approve: 'Aprovar e continuar',
  },
  es: {
    kicker: 'Power // Aprobación', title: 'Revisa antes de ejecutar',
    lead: 'Tu Equipo se detuvo antes de una acción externa. Revisa la solicitud.',
    always: 'La aprobación se solicita cada vez que se ejecuta este Power.',
    once: 'La aprobación solo vale para esta versión exacta del Assistant hasta que la revoques.',
    cancel: 'Cancelar', approve: 'Aprobar y continuar',
  },
  zh: {
    kicker: 'Power // 审批', title: '运行前检查',
    lead: '你的团队已在执行外部操作前暂停。请检查以下请求。',
    always: '每次运行此 Power 都需要审批。', once: '审批仅适用于此 Assistant 的当前精确版本，直到你撤销。',
    cancel: '取消', approve: '批准并继续',
  },
  fr: {
    kicker: 'Power // Approbation', title: 'Vérifier avant exécution',
    lead: 'Votre Équipe est en pause avant une action externe. Vérifiez la demande.',
    always: 'Une approbation est demandée à chaque exécution de ce Power.',
    once: "L’approbation ne vaut que pour cette version exacte de l’Assistant, jusqu’à révocation.",
    cancel: 'Annuler', approve: 'Approuver et continuer',
  },
  de: {
    kicker: 'Power // Freigabe', title: 'Vor der Ausführung prüfen',
    lead: 'Dein Team pausiert vor einer externen Aktion. Prüfe die Anfrage.',
    always: 'Bei jeder Ausführung dieses Powers ist eine Freigabe erforderlich.',
    once: 'Die Freigabe gilt nur für diese exakte Assistant-Version, bis du sie widerrufst.',
    cancel: 'Abbrechen', approve: 'Freigeben und fortfahren',
  },
  ja: {
    kicker: 'Power // 承認', title: '実行前に確認',
    lead: '外部操作の前にチームが一時停止しました。以下のリクエストを確認してください。',
    always: 'この Power を実行するたびに承認が必要です。', once: '承認は取り消すまで、この Assistant の同一バージョンだけに有効です。',
    cancel: 'キャンセル', approve: '承認して続行',
  },
  ar: {
    kicker: 'Power // الموافقة', title: 'راجع قبل التنفيذ',
    lead: 'توقف فريقك قبل إجراء خارجي. راجع الطلب أدناه.',
    always: 'تلزم الموافقة في كل مرة يتم فيها تشغيل هذا الـ Power.',
    once: 'تسري الموافقة على هذا الإصدار المحدد من الـ Assistant حتى تلغيها.',
    cancel: 'إلغاء', approve: 'موافقة ومتابعة',
  },
});

export function assistantApprovalsCopy(locale) {
  return ASSISTANT_APPROVALS_COPY[locale] ?? ASSISTANT_APPROVALS_COPY.en;
}
