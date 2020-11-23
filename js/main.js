let _width = $(window).width();
let _height = $(window).height();
let width = _width;
let height = _height;

let data = null;
let data_file = './data/data.json';
let institutionColors = {
    'Zhejiang University':'#0f4894',
    'University of Wisconsin - Madison':'#9a203e',
    'University of Washington':'#533788',
    'University of Toronto':'#0b3362',
    'University of Texas at Austin':'#cc5318',
    'University of Pennsylvania':'#0c1e55',
    'University of Michigan':'#fecd19',
    'University of Maryland - College Park':'#d7353e',
    'University of Illinois at Urbana-Champaign':'#e75132',
    'University of California - San Diego':'#0e719a',
    'University of California - Los Angeles':'#35508b',
    'University of California - Berkeley':'#0c3c69',
    'Tsinghua University':'#732bac',
    'The Hong Kong University of Science and Technology':'#263f6a',
    'Swiss Federal Institute of Technology Zurich':'#2c2c2c',
    'Stanford University':'#b41d1a',
    'Shanghai Jiao Tong University':'#ca2128',
    'Peking University':'#91180b',
    'Nanjing University':'#6a1a66',
    'Massachusetts Institute of Technology':'#0d393b',
    'Israel Institute of Technology':'#0d1440',
    'Georgia Institute of Technology':'#b6a770',
    'Fudan University':'#2a57a3',
    'Cornell University':'#b62226',
    'Columbia University':'#1451a7',
    'Chinese University of Hong Kong':'#742675',
    'Carnegie Mellon University':'#c6223a'
};

let constants = {
    k_Coulomb: -0.06, // 库伦力常数，符号影响排斥/吸引，负数是排斥
    k_Hooke: 0.03, // 弹簧弹力常数，正数是弹簧拉长时吸引，弹簧实际使用时会乘上学校间共享的人数
    d_Hooke: 100, // 弹簧的标准长度 现在是所有弹簧的标准长度均如此，与弹簧的强度等等无关
    mu: -0.5, // 阻力与速度的比值
    v_threshold: 0.01, // 收敛时的平均速度，越大收敛越快，但可能离完全收敛越远。
    delta_t: 0.2, // 模拟的时间步的长度，调大会使模拟变快，但可能会导致不精准
};
function calpercent(obj){//flag表示min是否取负数
    let Percent = (parseFloat(obj.value)-parseFloat(obj.min)) / (parseFloat(obj.max)-parseFloat(obj.min)) * 100;
    obj.style.background = `linear-gradient(to right, #ffa200, white ${Percent}%, white)`
}
let K_Coulomb = document.getElementById('k_Coulomb');
let K_Hooke = document.getElementById('k_Hooke');
let D_Hooke = document.getElementById('d_Hooke');
let Mu = document.getElementById('mu');
let V_threshold = document.getElementById('v_threshold');
let Delta_t = document.getElementById('delta_t');
function changeV() {
    constants.k_Coulomb = parseFloat(K_Coulomb.value);
    d3.select('#k_Coulomb_value').text(`k_Coulomb = ${constants.k_Coulomb}`);
    calpercent(K_Coulomb);
    constants.k_Hooke = parseFloat(K_Hooke.value);
    d3.select('#k_Hooke_value').text(`k_Hooke = ${constants.k_Hooke}`);
    calpercent(K_Hooke);
    constants.d_Hooke = parseFloat(D_Hooke.value);
    d3.select('#d_Hooke_value').text(`d_Hooke = ${constants.d_Hooke}`);
    calpercent(D_Hooke);
    constants.mu = parseFloat(Mu.value);
    d3.select('#mu_value').text(`mu = ${constants.mu}`);
    calpercent(Mu);
    constants.v_threshold = parseFloat(V_threshold.value);
    d3.select('#v_threshold_value').text(`v_threshold = ${constants.v_threshold}`);
    calpercent(V_threshold);
    constants.delta_t = parseFloat(Delta_t.value);
    d3.select('#delta_t_value').text(`delta_t = ${constants.delta_t}`);
    calpercent(Delta_t);
    // 图布局算法
    draw_and_calc();
};
// 计算质心
let calc_center = function(nodes) {
    let sum_x = 0, sum_y = 0, sum_weight = 0;
    for (i in nodes) {
        sum_x += nodes[i].weight * nodes[i].x;
        sum_y += nodes[i].weight * nodes[i].y;
        sum_weight += nodes[i].weight;
    }
    return [sum_x / sum_weight, sum_y / sum_weight];
};

let calc_positions = new Worker('js/calc_positions.js');
let current_drawer;

function draw_and_calc(before_start = () => {}) {
    stop_drawing();
    calc_positions = new Worker('js/calc_positions.js');
    before_start();
    // 算法开始时间
    d = new Date()
    begin = d.getTime()
    // 算法结束时间
    calc_positions.postMessage([constants, nodes, links]);
    let draw = (xs, ys) => {
        for (let i = 0; i < nodes.length; ++i) {
            nodes[i].x = xs[i];
            nodes[i].y = ys[i];
        }
        link
            .attr("x1", d => nodes_dict[d.source].x)
            .attr("y1", d => nodes_dict[d.source].y)
            .attr("x2", d => nodes_dict[d.target].x)
            .attr("y2", d => nodes_dict[d.target].y);
        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
        text
            .attr("x", d => d.x+5)
            .attr("y", d => d.y-5);

        let [cx, cy] = calc_center(nodes);
    }
    current_drawer = setInterval(() => {
        calc_positions.onmessage = function (e) {
            calc_positions.onmessage = normal_wait;
            let [stop, xs, ys] = e.data;
            if (stop) stop_drawing();
            draw(xs, ys);
        }
    }, 1000/60);
    function normal_wait(e) {
        let [stop, xs, ys] = e.data;
        if (!stop) return;
        stop_drawing();
        draw(xs, ys);
    }
}
function stop_drawing() {
    if (current_drawer === undefined) return;
    clearInterval(current_drawer);
    current_drawer = undefined;
    calc_positions.terminate();
}

let links,nodes,nodes_dict,svg,link,node,text;
function randomize_nodes() {
    for (let x of nodes) {
        x.x = (Math.random() * 0.6 + 0.2) * width;
        x.y = (Math.random() * 0.6 + 0.2) * height;
    }
}
function clamp(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
}
function draw_graph() {
    // 数据格式
    // nodes = [{"id": 学校名称, "weight": 毕业学生数量}, ...]
    // links = [{"source": 毕业学校, "target": 任职学校, "weight": 人数}, ...]
    links = data.links;
    nodes = data.nodes;

    nodes_dict = {};
    for (i in nodes) {
        nodes_dict[nodes[i].id] = nodes[i]
    }

    randomize_nodes();
    link = svg.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke-width", d => Math.sqrt(d.weight))
        .classed("link", true)
        .on("mouseover", function (e, d) {
            d3.select(this).transition()
                .attr("stroke-width", 10)
                .attr("stroke-opacity", 0.3)
            let content = '<table>'
                + '<tr><td>Graduate from</td><td>' + `${d.source}` + '</td></tr>'
                + '<tr><td>Work at</td><td>'+ `${d.target}` + '</td></tr>'
                + '<tr><td>Number</td><td>'+ `${d.weight}` + '</td></tr>'
                + '</table>';

            d3.select('#tooltip').html(content)
                .style('left', `${(nodes_dict[d.source].x+nodes_dict[d.target].x)/2}` + 'px')
                .style('top', `${(nodes_dict[d.source].y+nodes_dict[d.target].y)*0.5}` + 'px')
                .style('visibility', 'visible');
        })
        .on("mouseout", function (e, d) {
            d3.select(this).transition()
                .attr("stroke-width", d => Math.sqrt(d.weight))
                .attr("stroke-opacity", 0.6)
            d3.select('#tooltip').style('visibility', 'hidden');
        });

    // nodes
    node = svg.append("g")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", d => Math.sqrt(d.weight) + 2)
        .attr("opacity",0.6)
        .attr("fill", (d)=>{
            if (d.id in institutionColors)
                return institutionColors[d.id]
            else
                return "steelblue"})
        .classed("node", true)
        .classed("fixed", d => d.fx !== undefined)
        .on("mouseover", function (e, d) {// 鼠标移动到node上时显示text
            d3.select(this).attr("opacity",0.3)
            link.attr("stroke",(l)=>{
                if(d.id == l.source)
                    return '#ff7f50';
                else if(d.id == l.target)
                    return '#008000'
                else
                    return '#999';
            })
            text
                .attr("display", function (f) {
                    if (f.id == d.id) {
                        return "null";
                    }
                    else {
                        return "none";
                    }
                })
        })
        .on("mouseout", function (e, d) {// 鼠标移出node后按条件判断是否显示text
            d3.select(this).attr("opacity",0.6)
            link.attr("stroke","#999")
            text
                .attr("display",  'none')
        });

    // 学校名称text，只显示满足条件的学校
    text = svg.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .text(d => d.id+' '+d.weight+' graduates')
        .attr("display", 'none');

    const drag = d3.drag()
        .on("start", dragstart)
        .on("drag", dragged)
        .on("end",dragend);

    node.call(drag).on("click", click);

    function click(event, d) {
        delete d.fx;
        delete d.fy;
        d3.select(this)
            .classed("fixed", false);
        draw_and_calc();
    }

    function dragstart() {
        d3.select(this).classed("fixed", true);
        stop_drawing();
    }

    function dragged(event, d) {
        d3.select(this)
            .attr("cx",d.x = event.x)
            .attr("cy",d.y = event.y)
            .attr('opacity',1);
        link
            .attr("x1", d => nodes_dict[d.source].x)
            .attr("y1", d => nodes_dict[d.source].y)
            .attr("x2", d => nodes_dict[d.target].x)
            .attr("y2", d => nodes_dict[d.target].y);
    }
    function dragend(event, d){
        d.fx = true;
        d.fy = true;
        draw_and_calc();
    }

    // 图布局算法
    draw_and_calc();

    // 绘制links, nodes和text的位置
    // 绘制已在graph_layout_algorithm中完成
}

function main() {
    d3.json(data_file).then(function (DATA) {
        svg = d3.select('#container')
            .select('svg')
            .attr('width', width)
            .attr('height', height);
        svg.append('g')
            .attr('transform', `translate(${width*0.55}, ${height*0.1})`)
            .append('text')
            .attr('class', 'title')
            .text('A Force-Directed Graph for Faculties That Research on Computer Science in Well-known Universities');
        d3.select('#selector')
            .style('left',_width*0.05 + 'px')
            .style('top', `${_height*0.05}` + 'px')
            .style('visibility', 'visible');
        d3.select('#restart')
            .on('click',()=>{
                draw_and_calc(randomize_nodes);
            });
        data = DATA;
        draw_graph();
    })
}

main()
