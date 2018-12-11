;(async () => {
  const response = await fetch('/requests')
  const requestData = await response.json()

  function githubLink(hash) {
    return `https://github.com/GoogleChrome/lighthouse/commit/${hash}`
  }

  function createTableRow(items) {
    const tr = document.createElement('tr')
    for (const item of items) {
      const td = document.createElement('td')
      td.innerHTML = item
      tr.appendChild(td)
    }
    return tr
  }

  for (const request of requestData) {
    const tr = createTableRow([
      request.id,
      `<a href="${request.url}">${request.url}</a>`,
      `<a href="${githubLink(request.hashA)}">${request.hashA.slice(0, 8)}...</a>`,
      `<a href="${githubLink(request.hashB)}">${request.hashB.slice(0, 8)}...</a>`,
      new Date(request.createdAt).toLocaleString(),
      _.startCase(request.status),
    ])

    document.getElementById('table-rows').appendChild(tr)
  }

  document.body.classList.remove('is-loading')
})(window.utils)
