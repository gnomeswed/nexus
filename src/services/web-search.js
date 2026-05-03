// Web Search - Free search via DuckDuckGo HTML
class WebSearch {
  /**
   * Search the web using DuckDuckGo (no API key needed)
   */
  async search(query, maxResults = 5) {
    try {
      // Use DuckDuckGo instant answer API
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'NexusOS/1.0' },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) throw new Error(`Search failed: ${response.status}`);

      const data = await response.json();
      const results = [];

      // Abstract (main answer)
      if (data.Abstract) {
        results.push({
          title: data.Heading || 'Result',
          snippet: data.Abstract,
          url: data.AbstractURL || ''
        });
      }

      // Related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, maxResults - results.length)) {
          if (topic.Text) {
            results.push({
              title: topic.Text.slice(0, 80),
              snippet: topic.Text,
              url: topic.FirstURL || ''
            });
          }
        }
      }

      // If no results from instant answer, try HTML scraping fallback
      if (results.length === 0) {
        return await this.searchHtmlFallback(query, maxResults);
      }

      return { success: true, query, results };
    } catch (error) {
      // Fallback to HTML scraping
      try {
        return await this.searchHtmlFallback(query, maxResults);
      } catch (e) {
        return {
          success: false,
          query,
          results: [],
          error: `Search failed: ${error.message}`
        };
      }
    }
  }

  /**
   * Fallback: scrape DuckDuckGo HTML results
   */
  async searchHtmlFallback(query, maxResults = 5) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NexusOS/1.0)'
      },
      signal: AbortSignal.timeout(10000)
    });

    const html = await response.text();
    const results = [];

    // Simple regex to extract results from DDG HTML
    const resultRegex = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>(.+?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>(.+?)<\/a>/g;
    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
      results.push({
        title: match[2].replace(/<[^>]+>/g, '').trim(),
        snippet: match[3].replace(/<[^>]+>/g, '').trim(),
        url: decodeURIComponent(match[1].replace('/l/?kh=-1&uddg=', ''))
      });
    }

    return { success: results.length > 0, query, results };
  }

  /**
   * Format search results as text for AI context
   */
  formatResults(searchResult) {
    if (!searchResult.success || searchResult.results.length === 0) {
      return `No results found for "${searchResult.query}".`;
    }
    return searchResult.results.map((r, i) =>
      `[${i + 1}] ${r.title}\n    ${r.snippet}\n    URL: ${r.url}`
    ).join('\n\n');
  }
}

module.exports = new WebSearch();
