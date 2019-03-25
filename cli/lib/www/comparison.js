;(async utils => {
  const {
    fetchData,
    render,
    renderEnvironment,
    populateHashSelectBoxes,
    convertMetricToGraphsAndTilesForABComparison,
    getPValue,
  } = utils

  const {data, sortedBatchIds} = await fetchData()
  let activeMetric = 'first-contentful-paint'
  const batchState = {
    batchIdA: _.find(sortedBatchIds, id => id.startsWith('official')) || sortedBatchIds[0],
    batchIdB: _.find(sortedBatchIds, id => !id.startsWith('official')) || sortedBatchIds[1],
  }
  if (batchState.batchIdA === batchState.batchIdB && sortedBatchIds.length > 1)
    batchState.batchIdB = sortedBatchIds[1]

  function registerMetricSelectHandler() {
    const metricSelect = document.getElementById('metric-select')
    metricSelect.addEventListener('change', () => {
      activeMetric = metricSelect.value
      renderWithBatches(batchState.batchIdA, batchState.batchIdB)
    })
  }

  function renderWithBatches(batchIdA, batchIdB) {
    data[batchIdA].metadata.uiName = `A (${data[batchIdA].metadata.hash.slice(0, 8)})`
    data[batchIdB].metadata.uiName = `B (${data[batchIdB].metadata.hash.slice(0, 8)})`

    const graphsRootEl = document.getElementById('graphs')
    graphsRootEl.textContent = ''

    const urls = _(data)
      .values()
      .flatMap(o => _.keys(o))
      .uniq()
      .value()

    const renderElements = []
    for (const url of urls) {
      const urlData = data[batchIdA][url]
      if (!urlData) continue

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

      if (activeMetric === 'audit-scores' || activeMetric === 'timing-breakdowns') {
        const metricOfInterest = activeMetric === 'audit-scores' ? /^audit-score.*$/ : /^timing-.*$/
        for (const metricName of Object.keys(urlData)) {
          if (!metricOfInterest.test(metricName)) continue
          const {value, statsA, statsB} = getPValue(metricName, {whereA, whereB})
          if (!statsA.length || !statsB.length) continue
          // Skip it if the dataset has no variance and pvalue of 100
          if (statsA[0][1].variance === 0 && statsB[0][1].variance === 0 && value === 100) continue
          // Skip it if the values are too small to care
          if (statsA[0][1].mean < 0.05 && statsB[0][1].mean < 0.05) continue

          convertMetricToGraphsAndTilesForABComparison({...renderData, metric: metricName})

          if (renderData.graphsRootEl.childElementCount) {
            renderElements.push({...renderData})
            renderData.graphsRootEl = document.createDocumentFragment()
            renderData.graphs = []
            renderData.tiles = []
          }
        }
      } else {
        convertMetricToGraphsAndTilesForABComparison({...renderData, metric: activeMetric})
        if (renderData.graphsRootEl.childElementCount) renderElements.push(renderData)
      }
    }

    const sortedRenderElements = _.orderBy(
      renderElements,
      [a => a.tiles[2][2].pValue, a => a.tiles[2][2].magnitude],
      ['asc', 'desc'],
    ).slice(0, 50)
    sortedRenderElements.forEach(el => graphsRootEl.appendChild(el.graphsRootEl))
    const graphs = _.flatMap(sortedRenderElements, 'graphs')
    const tiles = _.flatMap(sortedRenderElements, 'tiles')

    renderEnvironment({id: 'environment-a', batchId: batchState.batchIdA})
    renderEnvironment({id: 'environment-b', batchId: batchState.batchIdB})
    render({graphs, tiles})
  }

  renderWithBatches(batchState.batchIdA, batchState.batchIdB)
  populateHashSelectBoxes(data, batchState, renderWithBatches)
  registerMetricSelectHandler()
})(window.utils)
