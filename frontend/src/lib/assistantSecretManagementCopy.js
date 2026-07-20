export const ASSISTANT_SECRET_MANAGEMENT_COPY = Object.freeze({
  en: {
    rotate: 'Replace secrets', rotationTitle: 'Replace Assistant secrets',
    rotationLead: 'Enter only the values you want to replace. Existing values are never displayed.',
    save: 'Replace selected values', failed: 'The values could not be replaced. Every draft was cleared.',
    approvalsTitle: 'Remembered approvals', approvalsLead: 'Exact Powers approved once for this Team.',
    noApprovals: 'No Power approvals are remembered.', revoke: 'Revoke remembered approvals',
    revokeFailed: 'Remembered approvals could not be revoked.',
  },
  pt: {
    rotate: 'Trocar segredos', rotationTitle: 'Trocar segredos do Assistant',
    rotationLead: 'Informe apenas os valores que deseja trocar. Valores existentes nunca são exibidos.',
    save: 'Trocar valores selecionados', failed: 'Não foi possível trocar os valores. Todos os rascunhos foram apagados.',
    approvalsTitle: 'Aprovações lembradas', approvalsLead: 'Powers exatos aprovados uma vez para este Time.',
    noApprovals: 'Nenhuma aprovação de Power está lembrada.', revoke: 'Revogar aprovações lembradas',
    revokeFailed: 'Não foi possível revogar as aprovações lembradas.',
  },
  es: {
    rotate: 'Reemplazar secretos', rotationTitle: 'Reemplazar secretos del Assistant',
    rotationLead: 'Introduce solo los valores que quieras reemplazar. Los valores existentes nunca se muestran.',
    save: 'Reemplazar valores seleccionados', failed: 'No se pudieron reemplazar. Se borraron todos los borradores.',
    approvalsTitle: 'Aprobaciones recordadas', approvalsLead: 'Powers exactos aprobados una vez para este Equipo.',
    noApprovals: 'No hay aprobaciones de Power recordadas.', revoke: 'Revocar aprobaciones',
    revokeFailed: 'No se pudieron revocar las aprobaciones.',
  },
  zh: {
    rotate: '替换密钥', rotationTitle: '替换 Assistant 密钥', rotationLead: '只输入要替换的值。现有值绝不会显示。',
    save: '替换所选值', failed: '无法替换。所有草稿均已清除。', approvalsTitle: '已记住的审批',
    approvalsLead: '此团队一次批准的精确 Powers。', noApprovals: '没有已记住的 Power 审批。',
    revoke: '撤销已记住的审批', revokeFailed: '无法撤销已记住的审批。',
  },
  fr: {
    rotate: 'Remplacer les secrets', rotationTitle: 'Remplacer les secrets de l’Assistant',
    rotationLead: 'Saisissez uniquement les valeurs à remplacer. Les valeurs existantes ne sont jamais affichées.',
    save: 'Remplacer les valeurs', failed: 'Remplacement impossible. Tous les brouillons ont été effacés.',
    approvalsTitle: 'Approbations mémorisées', approvalsLead: 'Powers exacts approuvés une fois pour cette Équipe.',
    noApprovals: 'Aucune approbation de Power mémorisée.', revoke: 'Révoquer les approbations',
    revokeFailed: 'Impossible de révoquer les approbations.',
  },
  de: {
    rotate: 'Secrets ersetzen', rotationTitle: 'Assistant-Secrets ersetzen',
    rotationLead: 'Gib nur Werte ein, die ersetzt werden sollen. Bestehende Werte werden nie angezeigt.',
    save: 'Ausgewählte Werte ersetzen', failed: 'Werte konnten nicht ersetzt werden. Alle Entwürfe wurden gelöscht.',
    approvalsTitle: 'Gespeicherte Freigaben', approvalsLead: 'Einmalig freigegebene exakte Powers dieses Teams.',
    noApprovals: 'Keine Power-Freigaben gespeichert.', revoke: 'Gespeicherte Freigaben widerrufen',
    revokeFailed: 'Gespeicherte Freigaben konnten nicht widerrufen werden.',
  },
  ja: {
    rotate: 'シークレットを置換', rotationTitle: 'Assistant のシークレットを置換',
    rotationLead: '置換する値だけを入力してください。既存の値は表示されません。', save: '選択した値を置換',
    failed: '置換できませんでした。すべての下書きを消去しました。', approvalsTitle: '記憶された承認',
    approvalsLead: 'このチームで一度承認された正確な Powers。', noApprovals: '記憶された Power 承認はありません。',
    revoke: '記憶された承認を取り消す', revokeFailed: '承認を取り消せませんでした。',
  },
  ar: {
    rotate: 'استبدال الأسرار', rotationTitle: 'استبدال أسرار الـ Assistant',
    rotationLead: 'أدخل فقط القيم التي تريد استبدالها. لا تُعرض القيم الحالية مطلقًا.', save: 'استبدال القيم المحددة',
    failed: 'تعذر الاستبدال. تم مسح جميع المسودات.', approvalsTitle: 'الموافقات المحفوظة',
    approvalsLead: 'Powers الدقيقة التي تمت الموافقة عليها مرة لهذا الفريق.', noApprovals: 'لا توجد موافقات Power محفوظة.',
    revoke: 'إلغاء الموافقات المحفوظة', revokeFailed: 'تعذر إلغاء الموافقات المحفوظة.',
  },
});

export function assistantSecretManagementCopy(locale) {
  return ASSISTANT_SECRET_MANAGEMENT_COPY[locale] ?? ASSISTANT_SECRET_MANAGEMENT_COPY.en;
}
