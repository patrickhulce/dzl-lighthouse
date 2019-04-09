;(utils => {
  let data
  let sortedBatchIds
  let currentBatchId

  const REPO_URL = 'https://github.com/GoogleChrome/lighthouse'
  const noop = () => undefined

  let fetching = false
  async function getGithubHashInfo(hash) {
    const cachedCopy = localStorage.getItem(`hash_data-${hash}`)
    if (cachedCopy) return JSON.parse(cachedCopy)

    if (fetching) return
    fetching = true
    try {
      const response = await fetch(
        `https://api.github.com/repos/GoogleChrome/lighthouse/commits/${hash}`,
      )
      const json = await response.json()
      localStorage.setItem(`hash_data-${hash}`, JSON.stringify(json))
      return json
    } catch (err) {
      throw err
    } finally {
      fetching = false
    }
  }

  function createElement(parent, tagName, ...restArgs) {
    let id
    let classes
    if (restArgs.length === 1 && typeof restArgs[0] === 'object') {
      id = restArgs[0].id
      classes = restArgs[0].classes || []
    } else {
      classes = restArgs
    }

    const el = document.createElement(tagName)
    el.classList.add(...classes)
    if (id) el.id = id
    if (parent !== document) parent.appendChild(el)
    return el
  }

  function getMetricSuffix(metricName) {
    if (metricName.startsWith('timing')) return ' s'
    if (metricName.endsWith('deltasPercent')) return ' %'
    if (metricName.startsWith('first-')) return ' s'
    if (['interactive', 'speed-index'].includes(metricName)) return ' s'
    if (metricName.includes('totalTaskTime')) return ' ms'
    if (metricName.includes('totalByteWeight')) return ' KB'
    return ' %'
  }

  function getMetricDisplayName(metric) {
    return _.startCase(metric.replace(/^(audit-score|timing)-/, ''))
  }

  function getGraphTitle({url, metric}) {
    const urlPart = url ? `${url} - ` : ''
    const cleanMetric = getMetricDisplayName(metric)
    return `${urlPart}${cleanMetric}`
  }

  /**
   * @see https://stackoverflow.com/questions/16194730/seeking-a-statistical-javascript-function-to-return-p-value-from-a-z-score
   */
  function getZPercentile(z) {
    // z == number of standard deviations from the mean

    // If z is greater than 6.5 standard deviations from the mean just round it off.
    if (z < -6.5) return 0.0
    if (z > 6.5) return 1.0

    var factK = 1
    var sum = 0
    var term = 1
    var k = 0
    var loopStop = Math.exp(-23)
    while (Math.abs(term) > loopStop) {
      term =
        (((0.3989422804 * Math.pow(-1, k) * Math.pow(z, k)) / (2 * k + 1) / Math.pow(2, k)) *
          Math.pow(z, k + 1)) /
        factK
      sum += term
      k++
      factK *= k
    }
    sum += 0.5

    return sum
  }

  function computeStatistics(values) {
    const n = values.length
    const mean = _.sum(values) / n
    const sse = _.sum(values.map(x => Math.pow(x - mean, 2)))
    const variance = n === 1 ? 0 : sse / (n - 1)
    const stddev = Math.sqrt(variance)
    return {n, mean, sse, variance, stddev}
  }

  async function fetchData() {
    const response = await fetch(`/dashboard-data.json${location.search}`)
    data = await response.json()

    for (const [batchId, batch] of Object.entries(data)) {
      Object.defineProperty(batch, 'metadata', {
        value: batch._metadata,
        enumerable: false,
        writable: false,
      })
      const date = batchId.replace(/^.*?-(\d{4}-\d{2}-\d{2}T)/, '$1')
      batch.metadata.date = new Date(date)
      batch.metadata.hashDate = `${batch.metadata.hash.slice(0, 8)}-${date}`
      delete batch._metadata

      for (const [url, properties] of Object.entries(batch)) {
        for (let [propertyName, values] of Object.entries(properties)) {
          values = values.filter(x => Number.isFinite(x))

          if (propertyName.startsWith('audit-score')) {
            properties[propertyName] = values.map(x => x * 100)
            continue
          }

          if (propertyName.startsWith('category-')) {
            properties[propertyName] = values.map(x => x * 100)
            continue
          }

          if (propertyName.startsWith('timing-')) {
            properties[propertyName] = values.map(x => x / 1000)
            continue
          }

          if (!propertyName.startsWith('diagnostic')) {
            values = values.map(x => x / 1000)
          }

          if (propertyName.includes('totalByteWeight')) {
            values = values.map(x => Math.round(x / 1024))
          }

          const {stddev, mean} = computeStatistics(values)
          const stddevPercent = stddev / mean || 0

          const deltas = values.map(x => x - mean)
          properties[propertyName] = values
          properties[`${propertyName}-deltas`] = deltas
          properties[`${propertyName}-deltasAbsolute`] = deltas.map(x => Math.abs(x))
          properties[`${propertyName}-deltasPercent`] = deltas.map(
            x => Math.round((10000 * Math.abs(x)) / mean || 0) / 100,
          )
          properties[`${propertyName}-mean`] = [mean]
          properties[`${propertyName}-stddev`] = [stddev]
          properties[`${propertyName}-stddevPercent`] = [stddevPercent]
        }
      }
    }

    sortedBatchIds = _(data)
      .sortBy(batch => batch.metadata.date.getTime())
      .map(b => b.metadata.batchId)
      .reverse()
      .value()

    const nonOfficialBatchIds = sortedBatchIds.filter(
      batchId => !data[batchId].metadata.label.startsWith('official-'),
    )

    currentBatchId = nonOfficialBatchIds.length ? nonOfficialBatchIds[0] : sortedBatchIds[0]
    window.CURRENT_DATA = data
    return {currentBatchId, sortedBatchIds, data}
  }

  function iterateData(prop, opts = {}) {
    let {where, onURL = noop, onBatch = noop} = opts

    const allValues = []
    for (const [batchId, batch] of Object.entries(data)) {
      const batchData = {batchId, batch}
      const batchValues = []
      for (const [url, properties] of Object.entries(batch)) {
        const urlData = {...batchData, url, properties}
        if (where && !where(urlData)) continue
        if (!properties[prop]) continue

        const urlValues = properties[prop]
        onURL(urlValues, urlData)
        batchValues.push(...urlValues)
      }

      onBatch(batchValues, batchData)
      allValues.push(...batchValues)
    }

    return allValues
  }

  function getBoxAndWhiskerData(prop, opts = {}) {
    const datasets = []
    iterateData(prop, {
      ...opts,
      onBatch(batchValues, {batchId}) {
        if (!batchValues.length) return

        datasets.push({
          batchId: batchId,
          uiName: data[batchId].metadata.uiName,
          date: data[batchId].metadata.date,

          name: data[batchId].metadata.uiName || data[batchId].metadata.hashDate,
          y: batchValues,
          type: 'box',
        })
      },
    })

    return _.sortBy(datasets, set => set.uiName || set.date.getTime())
  }

  function getHistogramData(prop, opts = {}) {
    if (!opts.where) opts.where = o => o.batchId === currentBatchId

    const datasets = []
    iterateData(prop, {
      ...opts,
      onBatch(batchValues, {batchId}) {
        if (!batchValues.length) return

        datasets.push({
          x: batchValues,
          nbinsx: 8,
          type: 'histogram',
          name: data[batchId].metadata.uiName || data[batchId].metadata.hashDate,
        })
      },
    })

    if (opts.flatten) {
      return [
        {
          x: [].concat(...datasets.map(d => d.x)),
          nbinsx: 8,
          type: 'histogram',
          name: 'All Data',
        },
      ]
    }

    return datasets
  }

  function getAverageValue(prop, opts = {}) {
    if (!opts.where) opts.where = o => o.batchId === currentBatchId
    const values = iterateData(prop, opts)
    return _.sum(values) / values.length
  }

  function get99thValue(prop, opts = {}) {
    if (!opts.where) opts.where = o => o.batchId === currentBatchId
    const values = iterateData(prop, opts)
    return values.sort((a, b) => a - b)[Math.floor(values.length * 0.99)]
  }

  function getPValue(prop, opts) {
    const valuesA = []
    const valuesB = []
    iterateData(prop, {where: opts.whereA, onURL: (values, {url}) => valuesA.push({values, url})})
    iterateData(prop, {where: opts.whereB, onURL: (values, {url}) => valuesB.push({values, url})})

    if (!valuesA.length || !valuesB.length) return {value: NaN, statsA: [], statsB: []}

    const valuesAByURL = _(valuesA)
      .groupBy('url')
      .mapValues(items => _.flatten(items.map(x => x.values)))
      .value()
    const valuesBByURL = _(valuesB)
      .groupBy('url')
      .mapValues(items => _.flatten(items.map(x => x.values)))
      .value()

    const pvalues = {}
    const statsAByURL = {}
    const statsBByURL = {}
    for (const [url, urlValuesA] of Object.entries(valuesAByURL)) {
      const urlValuesB = valuesBByURL[url]

      const statsA = computeStatistics(urlValuesA)
      const statsB = computeStatistics(urlValuesB)

      const meanDifference = statsA.mean - statsB.mean
      const stddevOfSum = Math.sqrt(statsA.variance + statsB.variance)
      const z = stddevOfSum === 0 ? 0 : meanDifference / stddevOfSum
      const percentile = getZPercentile(z)

      pvalues[url] = Math.min(percentile, 1 - percentile) * 2
      statsAByURL[url] = statsA
      statsBByURL[url] = statsB
    }

    const minEntry = _.minBy(Object.entries(pvalues), '1')
    return {
      value: minEntry[1] * 100,
      statsA: Object.entries(statsAByURL),
      statsB: Object.entries(statsBByURL),
    }
  }

  function getMetricsByGroup(batchData) {
    return _(batchData)
      .values()
      .map(urlData => Object.keys(urlData))
      .flatten()
      .uniq()
      .groupBy(metric => {
        if (metric.startsWith('audit-score')) return 'Audit Scores'
        if (metric.startsWith('timing-')) return 'Timings'
        if (metric.startsWith('diagnostic-')) return 'Diagnostics'
        return 'Metric'
      })
      .value()
  }

  function populateHashSelectBoxes(data, batchState, renderWithBatches) {
    function createOptionElement(batch) {
      const optionEl = document.createElement('option')
      optionEl.textContent = `${batch.metadata.batchId} - (${batch.metadata.hash.slice(0, 8)})`
      optionEl.value = batch.metadata.batchId
      return optionEl
    }

    const hashASelect = document.getElementById('hash-a-select')
    const hashBSelect = document.getElementById('hash-b-select')
    const optionsA = []
    const optionsB = []

    // Add the entries with most recent first
    const entries = _.sortBy(Object.entries(data), ([id, batch]) =>
      batch.metadata.date.getTime(),
    ).reverse()
    for (const [batchId, batch] of entries) {
      const optionElA = createOptionElement(batch)
      optionElA.setAttribute('data-batch', batchId)
      optionElA.selected = batchState.batchIdA === batchId
      hashASelect.appendChild(optionElA)
      optionsA.push(optionElA)

      const optionElB = createOptionElement(batch)
      optionElB.setAttribute('data-batch', batchId)
      optionElB.selected = batchState.batchIdB === batchId
      hashBSelect.appendChild(optionElB)
      optionsB.push(optionElB)
    }

    hashASelect.addEventListener('change', () => {
      batchState.batchIdA = hashASelect.value
      renderWithBatches(batchState.batchIdA, batchState.batchIdB)
    })

    hashBSelect.addEventListener('change', () => {
      batchState.batchIdB = hashBSelect.value
      renderWithBatches(batchState.batchIdA, batchState.batchIdB)
    })
  }

  function convertMetricToGraphsAndTilesForABComparison({
    graphsRootEl,
    graphs,
    tiles,
    metric,
    url,
    whereA,
    whereB,
  }) {
    const title = getGraphTitle({url, metric})
    const cleanURL = url.replace(/[^a-z]+/gi, '')
    const domID = `${cleanURL}-${metric}`
    const boxWhere = o => whereA(o) || whereB(o)
    const boxMetric = metric.replace('-deltasPercent', '')
    const boxAndWhiskerData = getBoxAndWhiskerData(boxMetric, {where: boxWhere})
    const histogramDataA = getHistogramData(metric, {where: whereA})
    const histogramDataB = getHistogramData(metric, {where: whereB})
    if (!histogramDataA.length || !histogramDataB.length) return

    const values = _.flatMap(boxAndWhiskerData, set => set.y)
    const max = _.max(values)

    const rowEl = createElement(graphsRootEl, 'div', 'row')

    const histogramEl = createElement(rowEl, 'div', 'col-5', 'graph-container')
    histogramEl.id = `${domID}-hist`
    graphs.push([
      histogramEl.id,
      () => histogramDataA.concat(histogramDataB),
      {
        title,
        xaxis: {ticksuffix: getMetricSuffix(metric)},
      },
    ])

    const boxEl = createElement(rowEl, 'div', 'col-5', 'graph-container')
    boxEl.id = `${domID}-box`
    graphs.push([
      boxEl.id,
      () => boxAndWhiskerData,
      {
        title,
        yaxis: {ticksuffix: getMetricSuffix(boxMetric), range: [0, Math.max(max + 2, 5)]},
        xaxis: {
          zeroline: false,
          showticklabels: false,
        },
      },
    ])

    const tilesEl = createElement(rowEl, 'div', 'col-2', 'tiles-container')
    const avgAEl = createElement(tilesEl, 'div', {id: `${domID}-avg-a`, classes: ['tile']})
    const avgBEl = createElement(tilesEl, 'div', {id: `${domID}-avg-b`, classes: ['tile']})
    const pvalueAEl = createElement(tilesEl, 'div', {id: `${domID}-pvalue`, classes: ['tile']})
    const aValue = getAverageValue(metric, {where: whereA})
    const bValue = getAverageValue(metric, {where: whereB})
    const pValue = getPValue(metric, {whereA, whereB}).value
    const pMagnitude = Math.abs(aValue - bValue)
    const shouldFlagPValues = pMagnitude / Math.min(aValue, bValue) > 0.05 && pValue < 15
    tiles.push(
      [avgAEl.id, () => aValue, {title: 'Average A', unit: getMetricSuffix(metric).trim()}],
      [avgBEl.id, () => bValue, {title: 'Average B', unit: getMetricSuffix(metric).trim()}],
      [
        pvalueAEl.id,
        () => pValue,
        {
          aValue,
          bValue,
          pValue: Math.round(pValue),
          magnitude: pMagnitude,
          title: 'P-Value',
          unit: '%',
          errorThreshold: shouldFlagPValues ? 5 : -1,
          warnThreshold: shouldFlagPValues ? 15 : -1,
          descendingWarn: true,
        },
      ],
    )

    return {shouldFlagPValues, title, histogramId: histogramEl.id}
  }

  function renderEnvironment(opts = {}) {
    const {id = 'environment', batchId = currentBatchId} = opts
    const envEl = document.getElementById(id)
    if (!envEl) return

    const {hash, label, date} = data[batchId].metadata
    const hashLink = `${REPO_URL}/tree/${hash}`

    envEl.classList.add('environment')
    envEl.innerHTML = `
      <div class="row">
        <div class="col-4 hash-link">
          Hash: <a target="_blank" href="${hashLink}">${hash.slice(0, 8)}</a>
          <pre class="hash-link__tooltip">Loading...</pre>
        </div>
        <div class="col-4">Data Channel: <span>${label}</span></div>
        <div class="col-4">Data Collected: <span>${date.toLocaleString()}</span></div>
      </div>
    `

    const hashLinkEl = envEl.querySelector('.hash-link')
    const hashLinkTooltipEl = envEl.querySelector('.hash-link__tooltip')
    hashLinkEl.addEventListener('mouseover', async () => {
      if (!hashLinkTooltipEl.textContent.includes('Loading...')) return

      const hashInfo = await getGithubHashInfo(hash)
      hashLinkTooltipEl.textContent = [
        hashInfo.commit.message,
        `${hashInfo.commit.author.name} (${hashInfo.commit.author.email})`,
        new Date(hashInfo.commit.author.date).toLocaleString(),
      ].join('\n')
    })
  }

  function asyncNewPlot(...plotlyArgs) {
    return new Promise(resolve => {
      window.requestAnimationFrame(() => {
        Plotly.newPlot(...plotlyArgs)
        resolve()
      })
    })
  }

  async function render({graphs = [], tiles = []}) {
    const layout = {
      showlegend: false,
      margin: {pad: 5},
    }

    for (const [domId, dataFn, opts] of tiles) {
      const el = document.getElementById(domId)
      // reset any previous state
      el.textContent = ''

      const titleEl = document.createElement('div')
      titleEl.classList.add('title')
      titleEl.textContent = opts.title
      el.appendChild(titleEl)

      const value = dataFn()
      const valueAsString = value.toLocaleString(undefined, {maximumFractionDigits: 1})
      const valueEl = document.createElement('div')
      valueEl.classList.add('value')
      valueEl.textContent = `${valueAsString} ${opts.unit || ''}`
      el.appendChild(valueEl)

      const {warnThreshold, errorThreshold, descendingWarn} = opts
      const isAboveWarn = value >= warnThreshold
      const isAboveError = value >= errorThreshold
      const hasThresholds = Boolean(warnThreshold || errorThreshold)
      const isWarn = (isAboveWarn && !descendingWarn) || (!isAboveWarn && descendingWarn)
      const isError = (isAboveError && !descendingWarn) || (!isAboveError && descendingWarn)

      el.classList.toggle('tile--neutral', !hasThresholds)
      el.classList.toggle('tile--warn', Boolean(hasThresholds && isWarn && !isError))
      el.classList.toggle('tile--error', Boolean(hasThresholds && !!isError))
      el.classList.toggle('tile--success', Boolean(hasThresholds && !isWarn && !isError))
    }

    renderEnvironment()

    let numRendered = 0
    for (const el of document.querySelectorAll('input, select, button')) el.disabled = true
    for (const [domId, dataFn, layoutOverrides] of graphs) {
      await asyncNewPlot(domId, dataFn(), _.merge(_.cloneDeep(layout), layoutOverrides))
      numRendered++

      if (numRendered > 5) document.body.classList.remove('is-loading')
    }

    document.body.classList.remove('is-loading')
    for (const el of document.querySelectorAll('input, select, button')) el.disabled = false
  }

  async function fetchAndRender(opts) {
    await fetchData()
    await render(opts)
  }

  Object.assign(utils, {
    getBoxAndWhiskerData,
    getHistogramData,
    get99thValue,
    getAverageValue,
    getPValue,
    getMetricDisplayName,
    getMetricSuffix,
    getMetricsByGroup,
    getGraphTitle,
    iterateData,
    fetchData,
    fetchAndRender,
    populateHashSelectBoxes,
    convertMetricToGraphsAndTilesForABComparison,
    render,
    renderEnvironment,
    createElement,
  })
})((window.utils = {}))
