;(async () => {
  const response = await fetch('/requests')
  const requestData = await response.json()

  function githubURL(hash) {
    return `https://github.com/GoogleChrome/lighthouse/commit/${hash}`
  }

  function createLink({text, href}) {
    const a = document.createElement('a')
    a.href = href
    a.target = '_blank'
    a.rel = 'noopener'
    a.textContent = text
    a.style.display = 'block'
    return a
  }

  function createTableRow(items) {
    const tr = document.createElement('tr')
    for (let item of items) {
      const td = document.createElement('td')
      if (typeof item === 'string') {
        td.textContent = item
      } else {
        if (!Array.isArray(item)) item = [item]
        item.forEach(el => td.appendChild(el))
      }

      tr.appendChild(td)
    }
    return tr
  }

  for (const request of requestData) {
    const tr = createTableRow([
      createLink({text: request.id, href: `/dashboard-comparison?label=ondemand-${request.id}`}),
      request.url.split(',').map(url => createLink({text: url, href: url})),
      createLink({text: request.hashA.slice(0, 8), href: githubURL(request.hashA)}),
      createLink({text: request.hashB.slice(0, 8), href: githubURL(request.hashB)}),
      new Date(request.createdAt).toLocaleString(),
      _.startCase(request.status),
    ])

    document.getElementById('table-rows').appendChild(tr)
  }

  document.body.classList.remove('is-loading')
})(window.utils)
