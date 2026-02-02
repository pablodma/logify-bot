import * as cheerio from 'cheerio';

export interface WikiSection {
  title: string;
  content: string;
  level: number;
}

export interface WikiDocument {
  url: string;
  title: string;
  aircraft: string;
  sections: WikiSection[];
  rawContent: string;
}

/**
 * Scrapes a Hoggitworld Wiki page and extracts structured content
 */
export async function scrapeHoggitworld(url: string, aircraft: string): Promise<WikiDocument> {
  console.log(`📥 Scraping: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Logify-Bot/1.0 (DCS Wiki Indexer)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract page title
  const title = $('#firstHeading').text().trim() || $('h1').first().text().trim();

  // Remove unwanted elements
  $('.mw-editsection').remove(); // Edit links
  $('.navbox').remove(); // Navigation boxes
  $('.toc').remove(); // Table of contents
  $('.mbox-small').remove(); // Message boxes
  $('script').remove();
  $('style').remove();

  // Get main content
  const content = $('#mw-content-text .mw-parser-output');
  
  const sections: WikiSection[] = [];
  
  // Use a state object to avoid TypeScript narrowing issues with callbacks
  const state: { section: WikiSection | null; content: string[] } = {
    section: null,
    content: [],
  };

  // Helper to save current section
  const saveCurrentSection = () => {
    if (state.section && state.content.length > 0) {
      const contentText = state.content.join('\n').trim();
      if (contentText) {
        sections.push({
          title: state.section.title,
          content: contentText,
          level: state.section.level,
        });
      }
    }
  };

  // Process content elements
  content.children().each((_, element) => {
    const $el = $(element);
    const tagName = element.tagName.toLowerCase();

    // Handle headers - start new section
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      // Save previous section
      saveCurrentSection();

      const level = parseInt(tagName[1]);
      const sectionTitle = $el.find('.mw-headline').text().trim() || $el.text().trim();
      
      state.section = {
        title: sectionTitle,
        content: '',
        level,
      };
      state.content = [];
    } 
    // Handle paragraphs
    else if (tagName === 'p') {
      const text = $el.text().trim();
      if (text) {
        state.content.push(text);
      }
    }
    // Handle lists
    else if (tagName === 'ul' || tagName === 'ol') {
      const listItems: string[] = [];
      $el.find('li').each((_, li) => {
        const text = $(li).text().trim();
        if (text) {
          listItems.push(`• ${text}`);
        }
      });
      if (listItems.length > 0) {
        state.content.push(listItems.join('\n'));
      }
    }
    // Handle definition lists
    else if (tagName === 'dl') {
      $el.find('dt, dd').each((_, item) => {
        const text = $(item).text().trim();
        if (text) {
          const prefix = item.tagName.toLowerCase() === 'dt' ? '**' : '  ';
          state.content.push(`${prefix}${text}${item.tagName.toLowerCase() === 'dt' ? '**' : ''}`);
        }
      });
    }
    // Handle tables (extract text content)
    else if (tagName === 'table') {
      const tableContent: string[] = [];
      $el.find('tr').each((_, tr) => {
        const rowContent: string[] = [];
        $(tr).find('th, td').each((_, cell) => {
          const text = $(cell).text().trim();
          if (text) {
            rowContent.push(text);
          }
        });
        if (rowContent.length > 0) {
          tableContent.push(rowContent.join(' | '));
        }
      });
      if (tableContent.length > 0) {
        state.content.push(tableContent.join('\n'));
      }
    }
    // Handle divs with content
    else if (tagName === 'div') {
      const text = $el.text().trim();
      // Only include if it's not too long (avoid huge nested divs)
      if (text && text.length < 2000) {
        state.content.push(text);
      }
    }
  });

  // Save last section
  saveCurrentSection();

  // If no sections found, create one from all content
  if (sections.length === 0) {
    const allText = content.text().trim();
    if (allText) {
      sections.push({
        title: 'Main Content',
        content: allText,
        level: 1,
      });
    }
  }

  // Build raw content for full-text reference
  const rawContent = sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n');

  console.log(`✅ Scraped "${title}" with ${sections.length} sections`);

  return {
    url,
    title,
    aircraft,
    sections,
    rawContent,
  };
}

/**
 * Known Hoggitworld aircraft pages
 */
export const HOGGITWORLD_AIRCRAFT_URLS: Record<string, string> = {
  'F/A-18C': 'https://wiki.hoggitworld.com/view/F/A-18C',
  'F-16C': 'https://wiki.hoggitworld.com/view/F-16C',
  'A-10C': 'https://wiki.hoggitworld.com/view/A-10C',
  'F-14': 'https://wiki.hoggitworld.com/view/F-14',
  'AH-64D': 'https://wiki.hoggitworld.com/view/AH-64D',
  'AV-8B': 'https://wiki.hoggitworld.com/view/AV-8B',
};
