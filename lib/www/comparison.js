;(async utils => {
  const {
    createElement,
    fetchData,
    render,
    renderEnvironment,
    getBoxAndWhiskerData,
    getHistogramData,
    getAverageValue,
    getPValue,
  } = utils

  const SUFFIX_BY_METRIC = {
    'timing-total': ' s',
    'first-contentful-paint': ' s',
    interactive: ' s',
    'first-contentful-paint-deltasPercent': ' %',
    'interactive-deltasPercent': ' %',
  }

  const {data, sortedBatchIds} = await fetchData()
  let metric = 'timing-total'
  let batchIdA = sortedBatchIds[sortedBatchIds.length - 1]
  let batchIdB = sortedBatchIds[sortedBatchIds.length - 2]

  function createOptionElement(batch) {
    const optionEl = document.createElement('option')
    optionEl.textContent = `${batch.metadata.batchId} - (${batch.metadata.hash.slice(0, 8)})`
    optionEl.value = batch.metadata.batchId
    return optionEl
  }

  function populateHashSelectBoxes(data) {
    const hashASelect = document.getElementById('hash-a-select')
    const hashBSelect = document.getElementById('hash-b-select')
    const metricSelect = document.getElementById('metric-select')
    const optionsA = []
    const optionsB = []

    // Add the entries with most recent first
    const entries = _.sortBy(Object.entries(data), entry => entry[0]).reverse()
    for (const [batchId, batch] of entries) {
      const optionElA = createOptionElement(batch)
      optionElA.setAttribute('data-batch', batchId)
      optionElA.selected = batchIdA === batchId
      hashASelect.appendChild(optionElA)
      optionsA.push(optionElA)

      const optionElB = createOptionElement(batch)
      optionElB.setAttribute('data-batch', batchId)
      optionElB.selected = batchIdB === batchId
      hashBSelect.appendChild(optionElB)
      optionsB.push(optionElB)
    }

    hashASelect.addEventListener('change', () => {
      batchIdA = hashASelect.value
      renderWithBatches(batchIdA, batchIdB)
    })

    hashBSelect.addEventListener('change', () => {
      batchIdB = hashBSelect.value
      renderWithBatches(batchIdA, batchIdB)
    })

    metricSelect.addEventListener('change', () => {
      metric = metricSelect.value
      renderWithBatches(batchIdA, batchIdB)
    })
  }

  function renderWithBatches(batchIdA, batchIdB) {
    const graphsRootEl = document.getElementById('graphs')
    graphsRootEl.textContent = ''

    const graphs = []
    const tiles = []
    const urls = _(data)
      .values()
      .flatMap(o => _.keys(o))
      .uniq()
      .value()

    for (const url of urls) {
      const cleanURL = url.replace(/[^a-z]+/gi, '')
      const whereA = o => o.url === url && o.batchId === batchIdA
      const whereB = o => o.url === url && o.batchId === batchIdB
      const boxWhere = o => whereA(o) || whereB(o)
      const boxMetric = metric.replace('-deltasPercent', '')
      const boxAndWhiskerData = getBoxAndWhiskerData(boxMetric, {where: boxWhere})
      const histogramDataA = getHistogramData(metric, {where: whereA})
      const histogramDataB = getHistogramData(metric, {where: whereB})
      const values = _.flatMap(boxAndWhiskerData, set => set.y)
      const max = _.max(values)

      const rowEl = createElement(graphsRootEl, 'div', 'row')

      const histogramEl = createElement(rowEl, 'div', 'col-5', 'graph-container')
      histogramEl.id = `${cleanURL}-hist`
      graphs.push([
        histogramEl.id,
        () => histogramDataA.concat(histogramDataB),
        {
          title: url,
          xaxis: {ticksuffix: SUFFIX_BY_METRIC[metric]},
        },
      ])

      const boxEl = createElement(rowEl, 'div', 'col-5', 'graph-container')
      boxEl.id = `${cleanURL}-box`
      graphs.push([
        boxEl.id,
        () => boxAndWhiskerData,
        {
          title: url,
          yaxis: {ticksuffix: SUFFIX_BY_METRIC[boxMetric], range: [0, Math.max(max + 2, 5)]},
          xaxis: {
            zeroline: false,
            showticklabels: false,
          },
        },
      ])

      const tilesEl = createElement(rowEl, 'div', 'col-2', 'tiles-container')
      const avgAEl = createElement(tilesEl, 'div', {id: `${cleanURL}-avg-a`, classes: ['tile']})
      const avgBEl = createElement(tilesEl, 'div', {id: `${cleanURL}-avg-b`, classes: ['tile']})
      const pvalueAEl = createElement(tilesEl, 'div', {id: `${cleanURL}-pvalue`, classes: ['tile']})
      tiles.push(
        [
          avgAEl.id,
          () => getAverageValue(metric, {where: whereA}),
          {title: 'Average A', unit: SUFFIX_BY_METRIC[metric].trim()},
        ],
        [
          avgBEl.id,
          () => getAverageValue(metric, {where: whereB}),
          {title: 'Average B', unit: SUFFIX_BY_METRIC[metric].trim()},
        ],
        [
          pvalueAEl.id,
          () => getPValue(metric, {whereA, whereB}),
          {
            title: 'P-Value',
            unit: '%',
            errorThreshold: 5,
            warnThreshold: 15,
            descendingWarn: true,
          },
        ],
      )
    }

    render({graphs, tiles})
    renderEnvironment({id: 'environment-a', batchId: batchIdA})
    renderEnvironment({id: 'environment-b', batchId: batchIdB})
  }

  renderWithBatches(batchIdA, batchIdB)
  populateHashSelectBoxes(data)
})(window.utils)
