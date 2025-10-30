test "Fold::collect - One variant" {
  let fold = Fold::One('a')
  let result = fold.collect()
  assert_eq(result, ['a'])
}

test "Fold::collect - Two variant" {
  let fold = Fold::Two('s', 's')
  let result = fold.collect()
  assert_eq(result, ['s', 's'])
}

test "Fold::collect - Three variant" {
  let fold = Fold::Three('f', 'f', 'i')
  let result = fold.collect()
  assert_eq(result, ['f', 'f', 'i'])
}

test "Fold::collect - Unicode characters" {
  let fold_one = Fold::One('α')
  assert_eq(fold_one.collect(), ['α'])
  
  let fold_two = Fold::Two('i', '\u{0307}')
  assert_eq(fold_two.collect(), ['i', '\u{0307}'])
  
  let fold_three = Fold::Three('\u{03b9}', '\u{0308}', '\u{0301}')
  assert_eq(fold_three.collect(), ['\u{03b9}', '\u{0308}', '\u{0301}'])
}

test "Fold variants equality" {
  let fold1 = Fold::One('a')
  let fold2 = Fold::One('a')
  assert_eq(fold1.collect(), fold2.collect())
  
  let fold3 = Fold::Two('s', 's')
  let fold4 = Fold::Two('s', 's')
  assert_eq(fold3.collect(), fold4.collect())
  
  let fold5 = Fold::Three('f', 'f', 'i')
  let fold6 = Fold::Three('f', 'f', 'i')
  assert_eq(fold5.collect(), fold6.collect())
}
