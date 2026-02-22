import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  PageBreak,
  Packer,
  convertMillimetersToTwip,
  SectionType,
} from 'docx';
import { saveAs } from 'file-saver';

interface DocxNode {
  type: string;
  content?: { type: string; text?: string }[];
}

function getNodeText(node: DocxNode): string {
  if (!node.content) return '';
  return node.content
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!)
    .join('');
}

function shouldUppercase(type: string): boolean {
  return ['sceneHeading', 'sceneParticipants', 'characterCue', 'transition'].includes(type);
}

function nodeToParagraph(node: DocxNode): Paragraph {
  const raw = getNodeText(node);
  const text = shouldUppercase(node.type) ? raw.toUpperCase() : raw;

  switch (node.type) {
    case 'sceneHeading':
      return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 360, after: 120 },
        children: [new TextRun({ text, bold: true, font: 'Times New Roman', size: 24 })],
      });

    case 'sceneParticipants':
      return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 240 },
        children: [new TextRun({ text, font: 'Times New Roman', size: 24 })],
      });

    case 'action':
    case 'paragraph':
      return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
        children: [new TextRun({ text: raw, font: 'Times New Roman', size: 24 })],
      });

    case 'characterCue':
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 0 },
        children: [new TextRun({ text, font: 'Times New Roman', size: 24 })],
      });

    case 'parenthetical':
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        indent: {
          left: convertMillimetersToTwip(25),
          right: convertMillimetersToTwip(25),
        },
        children: [new TextRun({ text: raw, italics: true, font: 'Times New Roman', size: 24 })],
      });

    case 'dialogue':
      return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
        indent: {
          left: convertMillimetersToTwip(40),
          right: convertMillimetersToTwip(30),
        },
        children: [new TextRun({ text: raw, font: 'Times New Roman', size: 24 })],
      });

    case 'transition':
      return new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text, font: 'Times New Roman', size: 24 })],
      });

    default:
      return new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: raw, font: 'Times New Roman', size: 24 })],
      });
  }
}

export async function exportScreenplayDocx(
  title: string,
  editorJson: any
) {
  const projectTitle = title || 'Screenplay';
  const today = new Date().toLocaleDateString('kk-KZ');

  // Title page
  const titlePage = [
    new Paragraph({ spacing: { before: 6000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: projectTitle.toUpperCase(), bold: true, font: 'Times New Roman', size: 32 })],
    }),
    new Paragraph({ spacing: { before: 600 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Дата: ${today}`, font: 'Times New Roman', size: 24 })],
    }),
    new Paragraph({
      children: [new PageBreak()],
    }),
  ];

  // Content
  const nodes: DocxNode[] = editorJson?.content || [];
  const contentParagraphs = nodes
    .filter((n) => getNodeText(n).trim().length > 0 || n.type !== 'paragraph')
    .map(nodeToParagraph);

  if (contentParagraphs.length === 0) {
    throw new Error('Сценарий бос');
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          type: SectionType.CONTINUOUS,
          page: {
            margin: {
              top: convertMillimetersToTwip(25),
              bottom: convertMillimetersToTwip(25),
              left: convertMillimetersToTwip(30),
              right: convertMillimetersToTwip(20),
            },
          },
        },
        children: [...titlePage, ...contentParagraphs],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${projectTitle.replace(/\s+/g, '_')}_screenplay.docx`;
  saveAs(blob, filename);
}
