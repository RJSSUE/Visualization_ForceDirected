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



let k_Coulomb = -0.06; // 库伦力常数，符号影响排斥/吸引，负数是排斥
let k_Hooke = 0.03; // 弹簧弹力常数，正数是弹簧拉长时吸引，弹簧实际使用时会乘上学校间共享的人数
let d_Hooke = 100; // 弹簧的标准长度 现在是所有弹簧的标准长度均如此，与弹簧的强度等等无关
let mu = -0.5; // 阻力与速度的比值
let v_threshold = 0.01; // 收敛时的平均速度，越大收敛越快，但可能离完全收敛越远。
let delta_t = 1; // 模拟的时间步的长度，调大会使模拟变快，但可能会导致不精准
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
    k_Coulomb = parseFloat(K_Coulomb.value);
    d3.select('#k_Coulomb_value').text(`k_Coulomb = ${k_Coulomb}`);
    calpercent(K_Coulomb);
    k_Hooke = parseFloat(K_Hooke.value);
    d3.select('#k_Hooke_value').text(`k_Hooke = ${k_Hooke}`);
    calpercent(K_Hooke);
    d_Hooke = parseFloat(D_Hooke.value);
    d3.select('#d_Hooke_value').text(`d_Hooke = ${d_Hooke}`);
    calpercent(D_Hooke);
    mu = parseFloat(Mu.value);
    d3.select('#mu_value').text(`mu = ${mu}`);
    calpercent(Mu);
    v_threshold = parseFloat(V_threshold.value);
    d3.select('#v_threshold_value').text(`v_threshold = ${v_threshold}`);
    calpercent(V_threshold);
    delta_t = parseFloat(Delta_t.value);
    d3.select('#delta_t_value').text(`delta_t = ${delta_t}`);
    calpercent(Delta_t);
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

// 计算每个节点的加速度。
let calc_acceleration = function(nodes, links) {
    // Fx[]和Fy[]分别代表受力在x, y方向的分量
    let Fx = nodes.xs.map(x => 0), Fy = nodes.xs.map(x => 0);
    let xs = nodes.xs, ys = nodes.ys, weights = nodes.weights;
    const len = nodes.xs.length;
    
    // 计算库伦力
    for (let i = 0; i < len; ++i) {
        for (let j = 0; j < i; ++j) {
            let dx = xs[j] - xs[i];
            let dy = ys[j] - ys[i];
            let d = dx * dx + dy * dy;
            let F = k_Coulomb * weights[i] * weights[j] / d;
            Fx[i] += F * dx;
            Fx[j] += -F * dx;
            Fy[i] += F * dy;
            Fy[j] += -F * dy;
        }
    }

    // 计算弹簧弹力
    const len_links = links.length;
    for (let l = 0; l < len_links; ++l) {
        let src = links[l].source;
        let tgt = links[l].target;
        if (src == tgt) continue;
        let dx = xs[src] - xs[tgt];
        let dy = ys[src] - ys[tgt];
        let d = Math.hypot(dx, dy);
        let F = k_Hooke * (d - d_Hooke) * links[l].weight;
        Fx[src] += -F * dx / d;
        Fy[src] += -F * dy / d;
        Fx[tgt] += F * dx / d;
        Fy[tgt] += F * dy / d;
    }
    
    // 计算阻力
    for (let i = 0; i < len; ++i) {
        Fx[i] += mu * nodes.vx[i];
        Fy[i] += mu * nodes.vy[i];
    }

    // 计算加速度
    for (let i = 0; i < len; ++i) {
        Fx[i] /= weights[i];
        Fy[i] /= weights[i];
    }
    return [Fx, Fy];
};

// 需要实现一个图布局算法，给出每个node的x,y属性
// f是每步的可视化
async function graph_layout_algorithm(nodes, links, f) {
    // 算法开始时间
    d = new Date()
    begin = d.getTime()

    const len = nodes.length;
    // 产生全0数组的便捷函数
    let get_zeros = function() {
        let ret = new Array(len);
        ret.fill(0);
        return ret;
    };

    // nodes的代替品，用来盛放中间结果，OoA = Object of Arrays
    let nodes_OoA = {xs: [], ys: [], weights: [], vx: get_zeros(), vy: get_zeros()};
    for (let i = 0; i < len; ++i) {
        nodes_OoA.weights[i] = nodes[i].weight;
    }
    // 把数据从nodes_OoA转移到nodes的函数
    let move_data = () => {
        for (let i = 0; i < len; ++i) {
            nodes[i].x = nodes_OoA.xs[i];
            nodes[i].y = nodes_OoA.ys[i];
        }
    };

    // 收敛时的总动能
    let KE_threshold = nodes_OoA.weights.reduce((a, b) => a + b) * v_threshold * v_threshold;

    let id2idx = {};
    for (let i = 0; i < len; ++i) {
        id2idx[nodes[i].id] = i;
    }
    // links的代替品，把节点的名字换成了它们的编号
    let new_links = links.map(x => { return {source: id2idx[x.source], target: id2idx[x.target], weight: x.weight}; });

    //这是一个随机布局，请在这一部分实现图布局算法
    // Beeman's method
    // 随机初始化 x_0
    for (let i = 0; i < len; ++i) {
        nodes_OoA.xs[i] = Math.random() * 0.6 * width + 0.2 * width;
        nodes_OoA.ys[i] = Math.random() * 0.6 * height + 0.2 * height;
    }
    // a_{t - Δt}的x分量和y分量
    let ax_minus_delta_t = get_zeros(), ay_minus_delta_t = get_zeros();
    // a_t的x分量和y分量
    let [ax, ay] = calc_acceleration(nodes_OoA, new_links);

    while (true) {
        for (let i = 0; i < len; ++i) {
            nodes_OoA.xs[i] += (nodes_OoA.vx[i] + (4 * ax[i] - ax_minus_delta_t[i]) / 6 * delta_t) * delta_t;
            nodes_OoA.ys[i] += (nodes_OoA.vy[i] + (4 * ay[i] - ay_minus_delta_t[i]) / 6 * delta_t) * delta_t;
            nodes_OoA.vx[i] += (3 * ax[i] - ax_minus_delta_t[i]) / 2 * delta_t;
            nodes_OoA.vy[i] += (3 * ay[i] - ay_minus_delta_t[i]) / 2 * delta_t;
        }
        // a_{t + Δt}的x分量和y分量
        let [new_ax, new_ay] = calc_acceleration(nodes_OoA, new_links);
        for (let i = 0; i < len; ++i) {
            nodes_OoA.vx[i] += 5 * (new_ax[i] - 2 * ax[i] + ax_minus_delta_t[i]) * delta_t / 12;
            nodes_OoA.vy[i] += 5 * (new_ay[i] - 2 * ay[i] + ay_minus_delta_t[i]) * delta_t / 12;
        }
        // 计算动能并判断是否需要结束
        let KE = 0;
        for (let i = 0; i < len; ++i) {
            KE += nodes_OoA.weights[i] * (nodes_OoA.vx[i] * nodes_OoA.vx[i] + nodes_OoA.vy[i] * nodes_OoA.vy[i]);
        }
        if (KE < KE_threshold) break;
        ax_minus_delta_t = ax;
        ay_minus_delta_t = ay;
        ax = new_ax;
        ay = new_ay;
    }

    // 算法结束时间
    d2 = new Date()
    end = d2.getTime()

    move_data();
    await f();
    alert(end - begin);

    // 保存图布局结果和花费时间为json格式，并按提交方式中重命名，提交时请注释这一部分代码
    //var content = JSON.stringify({"time": end-begin, "nodes": nodes, "links": links});
    //var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    //saveAs(blob, "save.json");
}

async function draw_graph() {
    let svg = d3.select('#container')
        .select('svg')
        .attr('width', width)
        .attr('height', height);
    d3.select('#selector')
        .style('left',_width*0.05 + 'px')
        .style('top', `${_height*0.05}` + 'px')
        .style('visibility', 'visible');

    // 数据格式
    // nodes = [{"id": 学校名称, "weight": 毕业学生数量}, ...]
    // links = [{"source": 毕业学校, "target": 任职学校, "weight": 人数}, ...]
    let links = data.links;
    let nodes = data.nodes;

    let nodes_dict = {};
    for (i in nodes) {
        nodes_dict[nodes[i].id] = nodes[i]
    }

    let link = svg.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke-width", d => Math.sqrt(d.weight))
        .on("mouseover", function (e, d) {
            console.log(d3.select(this))
            console.log(d)
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
    let node = svg.append("g")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", d => Math.sqrt(d.weight) + 2)
        .attr("opacity",0.8)
        .attr("fill", (d)=>{
            if (d.id in institutionColors)
                return institutionColors[d.id]
            else
                return "steelblue"})
        // .call(drag(simulation))
        .on("mouseover", function (e, d) {// 鼠标移动到node上时显示text
            d3.select(this).attr("opacity",0.3)
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
            d3.select(this).attr("opacity",0.8)
            text
                .attr("display",  'none')
        });


    // center of mass
    let center = svg.append('g')
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5)
        .append('circle')
        .attr('r', d => 10)
        .attr('fill', 'red');

    // 学校名称text，只显示满足条件的学校
    let text = svg.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .text(d => d.id+' '+d.weight+' graduates')
        .attr("display", 'none');

    // 图布局算法
    graph_layout_algorithm(nodes, links, async function() {
        link
            .attr("x1", d => nodes_dict[d.source].x)
            .attr("y1", d => nodes_dict[d.source].y)
            .attr("x2", d => nodes_dict[d.target].x)
            .attr("y2", d => nodes_dict[d.target].y);
    
        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
        text
            .attr("x", d => d.x)
            .attr("y", d => d.y);
        
        let [cx, cy] = calc_center(nodes);
        center
            .attr('cx', cx)
            .attr('cy', cy);

        // 这是一个土法sleep，希望有更好的方法
        await new Promise(resolve => (setTimeout(resolve, 1)));
    });

    // 绘制links, nodes和text的位置
    // 绘制已在graph_layout_algorithm中完成
}

function main() {
    d3.json(data_file).then(function (DATA) {
        data = DATA;
        draw_graph();
        d3.select('#set')
            .on('click',()=>{
                draw_graph();
            });
    })
}

main()
