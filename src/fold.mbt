///|
pub enum Fold {
  One(Char)
  Two(Char, Char)
  Three(Char, Char, Char)
}

///|
pub fn collect(self : Fold) -> Array[Char] {
  match self {
    One(c) => [c]
    Two(c1, c2) => [c1, c2]
    Three(c1, c2, c3) => [c1, c2, c3]
  }
}
