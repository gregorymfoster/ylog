import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: <span><strong>ylog</strong> - Institutional Memory for Dev Teams</span>,
  project: {
    link: 'https://github.com/gregorymfoster/ylog',
  },
  docsRepositoryBase: 'https://github.com/gregorymfoster/ylog/tree/main/docs',
  footer: {
    text: 'ylog - Convert GitHub PR history into institutional memory',
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – ylog'
    }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="ylog" />
      <meta property="og:description" content="Convert GitHub PR history into institutional memory" />
      <link rel="icon" href="/favicon.ico" />
    </>
  ),
  primaryHue: 142,
  primarySaturation: 100,
  sidebar: {
    titleComponent({ title, type }) {
      if (type === 'separator') {
        return <span className="cursor-default">{title}</span>
      }
      return <>{title}</>
    },
    defaultMenuCollapseLevel: 1,
    toggleButton: true
  },
  toc: {
    title: 'On this page'
  },
  search: {
    placeholder: 'Search documentation...'
  },
  editLink: {
    text: 'Edit this page on GitHub →'
  },
  feedback: {
    content: 'Question? Give us feedback →',
    labels: 'feedback'
  },
  gitTimestamp: 'Last updated on'
}

export default config