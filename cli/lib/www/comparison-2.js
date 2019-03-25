;(async utils => {
  const {
    createElement,
    fetchData,
    render,
    renderEnvironment,
    populateHashSelectBoxes,
    convertMetricToGraphsAndTilesForABComparison,
  } = utils

  const {data, sortedBatchIds} = await fetchData()
  let activeMetrics = [
    'first-contentful-paint',
    'interactive',
    'speed-index',
    'diagnostic-totalByteWeight',
    'diagnostic-totalTaskTime',
  ]

  const batchState = {
    batchIdA: _.find(sortedBatchIds, id => id.startsWith('official')) || sortedBatchIds[0],
    batchIdB: _.find(sortedBatchIds, id => !id.startsWith('official')) || sortedBatchIds[1],
  }
  if (batchState.batchIdA === batchState.batchIdB && sortedBatchIds.length > 1)
    batchState.batchIdB = sortedBatchIds[1]

  function renderWithBatches(batchIdA, batchIdB) {
    data[batchIdA].metadata.uiName = `A (${data[batchIdA].metadata.hash.slice(0, 8)})`
    data[batchIdB].metadata.uiName = `B (${data[batchIdB].metadata.hash.slice(0, 8)})`

    const graphsRootEl = document.getElementById('graphs')
    graphsRootEl.textContent = ''

    const metricsToLookAtEl = createElement(graphsRootEl, 'div', 'row')
    const metricsToLookAt = []

    const urls = _(data)
      .values()
      .flatMap(o => _.keys(o))
      .uniq()
      .value()

    const renderElements = []
    for (const url of urls) {
      if (!data[batchIdA][url] || !data[batchIdB][url]) continue

      const whereA = o => o.url === url && o.batchId === batchIdA
      const whereB = o => o.url === url && o.batchId === batchIdB
      const renderData = {
        url,
        whereA,
        whereB,
        graphsRootEl: document.createDocumentFragment(),
        graphs: [],
        tiles: [],
      }

      const urlHeader = createElement(renderData.graphsRootEl, 'h2')
      urlHeader.textContent = `${url}`
      urlHeader.style.textAlign = 'center'
      for (const metric of activeMetrics) {
        const {
          shouldFlagPValues,
          title,
          histogramId,
        } = convertMetricToGraphsAndTilesForABComparison({
          ...renderData,
          metric,
        })

        if (shouldFlagPValues && !metric.includes('diagnostic'))
          metricsToLookAt.push([title, histogramId])
      }

      if (renderData.graphsRootEl.childElementCount) renderElements.push(renderData)
    }

    if (metricsToLookAt.length) {
      const header = createElement(metricsToLookAtEl, 'h3')
      header.textContent = 'Metrics to look at:'
      const list = createElement(header, 'ul')
      for (const metric of metricsToLookAt) {
        const item = createElement(list, 'li')
        const link = createElement(item, 'a')
        link.href = `#${metric[1]}`
        link.textContent = metric[0]
      }
    }

    const sortedRenderElements = _.orderBy(renderElements, el => el.url)
    sortedRenderElements.forEach(el => graphsRootEl.appendChild(el.graphsRootEl))
    const graphs = _.flatMap(sortedRenderElements, 'graphs')
    const tiles = _.flatMap(sortedRenderElements, 'tiles')

    renderEnvironment({id: 'environment-a', batchId: batchIdA})
    renderEnvironment({id: 'environment-b', batchId: batchIdB})
    render({graphs, tiles})
  }

  renderWithBatches(batchState.batchIdA, batchState.batchIdB)
  populateHashSelectBoxes(data, batchState, renderWithBatches)
})(window.utils)
