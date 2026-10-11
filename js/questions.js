/*
 * Сұрақтар қоры.
 *
 * Әр сұрақтың құрылымы:
 *   id       — бірегей идентификатор
 *   module   — тарау (js/content.js ішіндегі MODULES id-лерінің бірі)
 *   type     — "single" (бір дұрыс жауап), "multi" (бірнеше дұрыс жауап), "context" (контекстік)
 *   context  — контекстік мәтін (тек type: "context" үшін)
 *   q        — сұрақ мәтіні
 *   options  — жауап нұсқалары
 *   correct  — дұрыс жауаптардың индекстері (0-ден басталады)
 *   explain  — түсініктеме (міндетті емес)
 *
 * .docx файлдан автоматты толтыру: python3 tools/docx_to_questions.py сұрақтар.docx
 */
window.QUESTIONS = [];
